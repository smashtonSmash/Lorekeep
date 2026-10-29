// Battle view-model: party cards read their stats from the character sheet (one source of truth);
// monsters carry their own. Applying an attack writes HP back to whichever owns it.
import { getState, patch, setDoc } from '../core/store'
import type { Attack, Character, Combatant, Condition, Encounter, LogEntry, Trait } from '../core/types'
import { uid } from '../core/types'
import { acOf, acVersus, amod, armorOf, attacksOf, bodyArmor, endCombatEffects, hasEffect, updateItem } from '../rules/character'
import { durOf, maxDur } from '../rules/gear'
import type { AttackResult, Defender } from '../rules/combat'
import { takeDamage, heal as healHp } from '../rules/combat'

export interface Fighter {
  c: Combatant
  ch?: Character
  name: string
  ac: number
  hp: number
  maxHp: number
  temp: number
  attacks: Attack[]
  traits: Trait[]
  conditions: Condition[]
  initMod: number
  portrait?: string
}

export function fighterOf(c: Combatant, chars: Record<string, Character>): Fighter {
  const ch = c.characterId ? chars[c.characterId] : undefined
  if (ch) return { c, ch, name: ch.name, ac: acOf(ch), hp: ch.hp, maxHp: ch.maxHp, temp: ch.tempHp, attacks: attacksOf(ch), traits: ch.traits, conditions: ch.conditions, initMod: amod(ch, 'dex'), portrait: ch.portrait }
  return { c, name: c.name, ac: c.ac, hp: c.hp, maxHp: c.maxHp, temp: c.tempHp, attacks: c.attacks, traits: c.traits, conditions: c.conditions, initMod: c.initMod }
}

export function defenderOf(f: Fighter): Defender {
  if (f.ch) {
    const ch = f.ch
    const armorOn = !!bodyArmor(ch)
    const weapon = ch.inventory.find((i) => i.kind === 'weapon' && i.equipped)
    return {
      name: f.name, traits: ch.traits, armor: armorOn ? armorOf(ch) : undefined,
      acFor: (t, beast) => acVersus(ch, t, beast), stoneskin: hasEffect(ch, 'stoneskin'),
      mirrorType: hasEffect(ch, 'mirror') ? weapon?.coating?.type ?? weapon?.damageType : undefined,
    }
  }
  return { name: f.name, traits: f.traits, acFor: () => f.ac }
}

export const log = (e: Encounter, kind: LogEntry['kind'], text: string): Encounter => ({ ...e, log: [...e.log.slice(-79), { id: uid(), t: Date.now(), kind, text }] })
export const addLog = (kind: LogEntry['kind'], text: string) => setDoc('encounter', (e) => log(e, kind, text))

/** Change HP on whoever owns it. Positive = damage, negative = heal. */
export function changeHp(f: Fighter, amount: number, opts: { temp?: number; full?: boolean } = {}) {
  if (f.ch) {
    patch('chars', f.ch.id, (ch) => {
      if (opts.full) return { ...ch, hp: ch.maxHp }
      if (opts.temp != null) return { ...ch, tempHp: Math.max(0, opts.temp) }
      if (amount < 0) return { ...ch, hp: healHp(ch.hp, ch.maxHp, -amount) }
      const sw = hasEffect(ch, 'second-wind')
      const r = takeDamage(ch.hp, ch.tempHp, amount, sw)
      return { ...ch, hp: r.hp, tempHp: r.temp, effects: r.usedSecondWind ? ch.effects.filter((x) => x.key !== 'second-wind') : ch.effects }
    })
    return
  }
  setDoc('encounter', (e) => ({
    ...e,
    combatants: e.combatants.map((x) => {
      if (x.id !== f.c.id) return x
      if (opts.full) return { ...x, hp: x.maxHp }
      if (opts.temp != null) return { ...x, tempHp: Math.max(0, opts.temp) }
      if (amount < 0) return { ...x, hp: healHp(x.hp, x.maxHp, -amount) }
      const r = takeDamage(x.hp, x.tempHp, amount)
      return { ...x, hp: r.hp, tempHp: r.temp }
    }),
  }))
}

/** Commit an attack result: HP, armor wear on hit, weapon wear on miss, log. */
export function applyAttack(att: Fighter, tgt: Fighter, atk: Attack, r: AttackResult, opts: { shrug?: boolean } = {}) {
  let line = `${att.name} → ${atk.name}: ${r.log}`
  if (opts.shrug) line = `${att.name} → ${atk.name}: ${tgt.name} shrugs off the hit (1/day)`
  if (r.hit && !opts.shrug && r.damage > 0) changeHp(tgt, r.damage)
  if (opts.shrug && tgt.ch) patch('chars', tgt.ch.id, (c) => ({ ...c, shrugUsed: true }))
  // armor wear (party target)
  if (r.hit && r.wear && tgt.ch) {
    const a = bodyArmor(tgt.ch)
    if (a && maxDur(a) > 0) {
      const after = Math.max(0, durOf(a) - r.wear.amount)
      patch('chars', tgt.ch.id, (c) => updateItem(c, a.id, { dur: after }))
      line += ` · ${a.name} −${r.wear.amount} durability (${r.wear.reason})${after === 0 ? ' — BROKEN' : ''}`
    }
  }
  // weapon wear on a miss, and whetstone is spent on a hit
  if (att.ch && atk.itemId) {
    const w = att.ch.inventory.find((i) => i.id === atk.itemId)
    if (w && !r.hit && maxDur(w) > 0) {
      const after = Math.max(0, durOf(w) - r.weaponWear)
      patch('chars', att.ch.id, (c) => updateItem(c, w.id, { dur: after }))
      line += ` · ${w.name} −${r.weaponWear} durability${after === 0 ? ' — BROKEN' : ''}`
    }
    if (w?.coating?.crit && r.hit) patch('chars', att.ch.id, (c) => updateItem(c, w.id, { coating: { ...w.coating, crit: false } }))
  }
  setDoc('encounter', (e) => log(e, !r.hit ? 'miss' : r.crit ? 'crit' : 'hit', line))
  const after = tgt.hp + tgt.temp - (r.hit && !opts.shrug ? r.damage : 0)
  if (r.hit && !opts.shrug && after <= 0 && tgt.hp > 0) addLog('down', `${tgt.name} is down!`)
}

export function sortedTurnOrder(e: Encounter) {
  return [...e.combatants].sort((a, b) => (b.init ?? -99) - (a.init ?? -99))
}
export function nextTurn() {
  setDoc('encounter', (e) => {
    const order = sortedTurnOrder(e).filter((c) => c.init != null)
    if (!order.length) return e
    const i = order.findIndex((c) => c.id === e.turnId)
    const wrap = i === order.length - 1
    const next = order[(i + 1) % order.length]
    return log({ ...e, turnId: next.id, round: i === -1 ? e.round : wrap ? e.round + 1 : e.round }, 'info', wrap ? `Round ${e.round + 1} — ${next.name}'s turn` : `${next.name}'s turn`)
  })
}
export function endCombat() {
  const s = getState()
  for (const c of s.docs.encounter.combatants) if (c.characterId) patch('chars', c.characterId, endCombatEffects)
  setDoc('encounter', (e) => log({ ...e, round: 1, turnId: null, combatants: e.combatants.map((c) => ({ ...c, init: null })) }, 'info', 'Combat ended. Fight-long effects cleared (Ironhide, Mending Steel, Mirror Oil).'))
}
