// Character math: modifiers, AC, attacks, inventory, coin, slots, level-up, inspiration, spell slots.
import type { Ability, Attack, Character, DamageType, Item, Purse, Tier } from '../core/types'
import { uid } from '../core/types'
import { armorDef, profForLevel, wornArmor } from './armor'
import { durOf, isBroken, isDamaged, maxDur, shieldDef, slotsOf, stackKey, weaponDef } from './gear'
import { nextTier } from './tiers'

export const mod = (score: number) => Math.floor((score - 10) / 2)
export const score = (c: Character, a: Ability) => (c.abilities[a] ?? 10) + (c.bonuses?.[a] ?? 0)
export const amod = (c: Character, a: Ability) => mod(score(c, a))
export const prof = (c: Character) => c.profOverride ?? profForLevel(c.level)
export const hasEffect = (c: { effects?: Character['effects'] }, key: string) => (c.effects ?? []).some((e) => e.key === key)

// ---------- equipment ----------
export const equipped = (c: Character) => c.inventory.filter((i) => i.equipped)
export const bodyArmor = (c: Character) => c.inventory.find((i) => i.kind === 'armor' && i.equipped && !i.under)
export const underArmor = (c: Character) => c.inventory.find((i) => i.kind === 'armor' && i.equipped && i.under)
export const wieldedShield = (c: Character) => c.inventory.find((i) => i.kind === 'shield' && i.equipped)

/** Armor tier for this fight (Mending Steel raises it one step). */
function liveTier(c: Character, it: Item): Tier | undefined {
  if (!it.tier) return undefined
  return hasEffect(c, 'mending') ? nextTier(it.tier) ?? it.tier : it.tier
}

export function armorOf(c: Character) {
  const main = bodyArmor(c)
  const mending = hasEffect(c, 'mending')
  const usable = main && (mending || !isBroken(main)) ? main : undefined
  const under = underArmor(c)
  return wornArmor(
    usable ? { armorId: usable.armorId, tier: liveTier(c, usable), swornType: usable.swornType } : undefined,
    under && !isBroken(under) ? { armorId: under.armorId, tier: under.tier } : undefined,
    prof(c),
  )
}

/** Displayed AC (before per-type adjustments). */
export function acOf(c: Character): number {
  if (c.acManual != null) return c.acManual
  const dex = amod(c, 'dex')
  const main = bodyArmor(c)
  const mending = hasEffect(c, 'mending')
  let ac = 10 + dex
  if (main && (mending || !isBroken(main))) {
    const def = armorDef(main.armorId)
    if (def) {
      const st = armorOf(c)
      ac = def.base + (def.dexCap === null ? dex : Math.min(dex, def.dexCap)) + st.flat + st.underAc
      if (!mending && isDamaged(main)) ac -= 1
    }
  }
  const sh = wieldedShield(c)
  if (sh && sh.tier && !isBroken(sh)) {
    const def = shieldDef(sh.shieldId)
    const mode = sh.shieldMode ?? 'wielded'
    const counts = def && (def.fillsHand ? mode === 'wielded' : mode !== 'planted')
    if (def && counts) ac += def.ac[sh.tier] - (isDamaged(sh) ? 1 : 0)
  }
  ac += c.inventory.reduce((n, i) => n + (i.equipped && i.kind === 'accessory' ? i.perkAc ?? 0 : 0), 0)
  if (hasEffect(c, 'ironhide')) ac += 2
  return ac
}

/** AC against one damage type (and whether the attacker is a beast). */
export function acVersus(c: Character, type: DamageType, beast = false): number {
  const base = acOf(c)
  if (c.acManual != null) return base
  const st = armorOf(c)
  let n = st.acVs[type] ?? 0
  if (n < 0 && hasEffect(c, 'stoneskin')) n = 0
  return base + n + (beast ? st.beastAc : 0)
}

export const rangedPerk = (c: Character) => c.inventory.reduce((n, i) => n + (i.equipped && i.kind === 'accessory' ? i.perkRanged ?? 0 : 0), 0)
export const spellPerk = (c: Character) => c.inventory.reduce((n, i) => n + (i.equipped && i.kind === 'accessory' ? i.perkSpell ?? 0 : 0), 0)

/** Why this weapon can't be swung right now, or null. */
export function cannotWield(c: Character, it: Item): string | null {
  if (it.special === 'black' && !it.synced) return `${it.name} is not synced and will not be drawn.`
  if (it.special === 'black' && it.bondedTo && it.bondedTo !== c.id) return `${it.name} is bonded to someone else.`
  if (maxDur(it) > 0 && durOf(it) <= 0) return `${it.name} is Broken.`
  return null
}

/** Weapon attacks come from what's equipped; hand-typed attacks are kept as well. */
export function attacksOf(c: Character): Attack[] {
  const p = prof(c)
  const out: Attack[] = []
  for (const it of c.inventory) {
    if (!it.equipped) continue
    if (it.kind === 'weapon' && !cannotWield(c, it)) {
      const def = weaponDef(it.weaponId)
      const ranged = it.ranged ?? def?.ranged ?? /bow|sling|dart/i.test(it.name)
      const finesse = def?.finesse ?? false
      const m = ranged ? amod(c, 'dex') : finesse ? Math.max(amod(c, 'str'), amod(c, 'dex')) : amod(c, 'str')
      const dmg = it.damage ?? def?.damage ?? '1d6'
      out.push({
        id: `w-${it.id}`, itemId: it.id, name: it.name + (it.coating?.type ? ` (${it.coating.type} oil)` : ''),
        toHit: p + m + (ranged ? rangedPerk(c) : 0), damage: `${dmg}${m ? (m > 0 ? `+${m}` : `${m}`) : ''}`,
        damageType: it.coating?.type ?? it.damageType ?? def?.type ?? 'slashing', ranged,
        bonusDice: it.coating?.bonusDice, bonusType: it.coating?.bonusType,
      })
    }
    if (it.kind === 'shield' && it.damage && (it.shieldMode ?? 'wielded') === 'wielded' && !isBroken(it)) {
      const s = amod(c, 'str')
      out.push({ id: `s-${it.id}`, itemId: it.id, name: `${it.name} bash`, toHit: p + s, damage: `${it.damage}${s ? (s > 0 ? `+${s}` : s) : ''}`, damageType: 'bludgeoning' })
    }
  }
  return [...out, ...c.attacks]
}

// ---------- inventory ----------
export function addItem(c: Character, it: Item): Character {
  const key = stackKey(it)
  if (key) {
    const hit = c.inventory.find((x) => stackKey(x) === key && x.tier === it.tier)
    if (hit) return { ...c, inventory: c.inventory.map((x) => (x === hit ? { ...x, qty: x.qty + it.qty } : x)) }
  }
  return { ...c, inventory: [...c.inventory, { ...it, id: c.inventory.some((x) => x.id === it.id) ? uid() : it.id }] }
}
export function removeItem(c: Character, itemId: string, qty = Infinity): Character {
  return {
    ...c,
    inventory: c.inventory.flatMap((x) => (x.id !== itemId ? [x] : x.qty > qty ? [{ ...x, qty: x.qty - qty }] : [])),
  }
}
export const updateItem = (c: Character, itemId: string, patch: Partial<Item>): Character =>
  ({ ...c, inventory: c.inventory.map((x) => (x.id === itemId ? { ...x, ...patch } : x)) })

/** Equip with slot rules: one body armor (+ padded under-layer), one shield, one per accessory slot, two hands. */
export function toggleEquip(c: Character, itemId: string): { char: Character; message?: string } {
  const it = c.inventory.find((i) => i.id === itemId)
  if (!it) return { char: c }
  if (it.equipped) return { char: updateItem(c, itemId, { equipped: false, under: false }) }
  if (it.atForge) return { char: c, message: `${it.name} is still at the forge. The DM marks it ready.` }
  if (it.kind === 'weapon') {
    const block = cannotWield(c, it)
    if (block) return { char: c, message: block }
  }
  let inv = c.inventory
  const off = (pred: (i: Item) => boolean) => { inv = inv.map((i) => (i.equipped && pred(i) ? { ...i, equipped: false, under: false } : i)) }
  if (it.kind === 'armor') off((i) => i.kind === 'armor' && !i.under)
  if (it.kind === 'shield') off((i) => i.kind === 'shield')
  if (it.kind === 'accessory') off((i) => i.kind === 'accessory' && i.slot === it.slot)
  if (it.kind === 'weapon' || it.kind === 'shield') {
    // hands: two-hand weapons take both; small/medium shields sit beside a one-hander; a heavy shield allows no weapon
    const handsOf = (i: Item) => (i.kind === 'weapon' ? ((weaponDef(i.weaponId)?.slots ?? 1) > 1 ? 2 : 1) : i.kind === 'shield' ? (shieldDef(i.shieldId)?.fillsHand && (i.shieldMode ?? 'wielded') === 'wielded' ? 2 : 1) : 0)
    const need = handsOf(it)
    let used = inv.filter((i) => i.equipped && i.id !== it.id).reduce((n, i) => n + handsOf(i), 0)
    if (used + need > 2) {
      for (const i of inv.filter((x) => x.equipped && handsOf(x) > 0)) {
        if (used + need <= 2) break
        off((x) => x.id === i.id); used -= handsOf(i)
      }
    }
  }
  inv = inv.map((i) => (i.id === itemId ? { ...i, equipped: true } : i))
  return { char: { ...c, inventory: inv } }
}

export function encumbrance(c: Character) {
  const used = c.inventory.reduce((n, i) => n + slotsOf(i), 0)
  const cap = Math.max(1, score(c, 'str'))
  return { used, cap, over: used > cap }
}

// ---------- coin ----------
export const toSilver = (p?: Purse) => (p?.gold ?? 0) * 10 + (p?.silver ?? 0)
export const fromSilver = (s: number): Purse => ({ gold: Math.floor(Math.max(0, s) / 10), silver: Math.max(0, s) % 10 })
export const coinLabel = (p: Purse) => `${p.gold}g${p.silver ? ` ${p.silver}s` : ''}`
export const silverLabel = (s: number) => coinLabel(fromSilver(s))
export function pay(c: Character, silver: number): Character | null {
  if (toSilver(c.purse) < silver) return null
  // spend silver first, break gold only if needed, so purses keep their shape
  if (c.purse.silver >= silver) return { ...c, purse: { ...c.purse, silver: c.purse.silver - silver } }
  return { ...c, purse: fromSilver(toSilver(c.purse) - silver) }
}
export const receive = (c: Character, silver: number): Character => ({ ...c, purse: { gold: c.purse.gold + Math.floor(silver / 10), silver: c.purse.silver + (silver % 10) } })

// ---------- inspiration ----------
export const INSPIRATION_MAX = 2
export function giveInspiration(c: Character, now = Date.now()) {
  if ((c.inspiration ?? 0) >= INSPIRATION_MAX) return null
  return { ...c, inspiration: (c.inspiration ?? 0) + 1, inspirationPing: now }
}

// ---------- spell slots ----------
const FULL: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]
const pad9 = (a: number[]) => Array.from({ length: 9 }, (_, i) => a[i] ?? 0)

export interface CasterInfo { ability: Ability; kind: 'full' | 'half' | 'halfUp' | 'pact' }
export function casterInfo(cls: string): CasterInfo | null {
  const n = cls.toLowerCase()
  if (/wizard/.test(n)) return { ability: 'int', kind: 'full' }
  if (/sorcerer|bard/.test(n)) return { ability: 'cha', kind: 'full' }
  if (/cleric|druid/.test(n)) return { ability: 'wis', kind: 'full' }
  if (/warlock/.test(n)) return { ability: 'cha', kind: 'pact' }
  if (/paladin/.test(n)) return { ability: 'cha', kind: 'half' }
  if (/ranger/.test(n)) return { ability: 'wis', kind: 'half' }
  if (/artificer/.test(n)) return { ability: 'int', kind: 'halfUp' }
  return null
}

export function slotsFor(cls: string, level: number): { max: number[]; pact: boolean } {
  const info = casterInfo(cls)
  const L = Math.max(1, Math.min(20, level))
  if (!info) return { max: pad9([]), pact: false }
  if (info.kind === 'pact') {
    const count = L === 1 ? 1 : L <= 10 ? 2 : L <= 16 ? 3 : 4
    const lvl = Math.min(5, Math.ceil(L / 2))
    const max = pad9([]); max[lvl - 1] = count
    return { max, pact: true }
  }
  const eff = info.kind === 'full' ? L : info.kind === 'half' ? Math.floor(L / 2) : Math.ceil(L / 2)
  return { max: pad9(eff > 0 ? FULL[eff - 1] : []), pact: false }
}

export function enableCasting(c: Character): Character {
  const info = casterInfo(c.cls)
  const s = slotsFor(c.cls, c.level)
  return { ...c, caster: c.caster ?? { ability: info?.ability ?? 'int', max: info ? s.max : pad9([2]), used: pad9([]), pact: s.pact, manual: !info, known: [], custom: [] } }
}
export const spellDC = (c: Character) => (c.caster ? 8 + prof(c) + amod(c, c.caster.ability) : 0)
export const spellAttack = (c: Character) => (c.caster ? prof(c) + amod(c, c.caster.ability) + spellPerk(c) : 0)

// ---------- rests ----------
export function shortRest(c: Character): Character {
  const cs = c.caster && c.caster.pact ? { ...c.caster, used: pad9([]) } : c.caster
  return { ...c, caster: cs }
}
export function longRest(c: Character): Character {
  return {
    ...c, hp: c.maxHp, tempHp: 0, shrugUsed: false,
    caster: c.caster ? { ...c.caster, used: pad9([]) } : undefined,
    effects: c.effects.filter((e) => e.until === 'used'),
    inventory: c.inventory.map((i) => (i.coating ? { ...i, coating: undefined } : i)), // oils and whetstone last until a long rest
  }
}
/** End of combat clears fight-long effects. */
export const endCombatEffects = (c: Character): Character =>
  (c.effects.some((e) => e.until === 'combat') ? { ...c, effects: c.effects.filter((e) => e.until !== 'combat') } : c)

// ---------- level up ----------
export const hitDieAverage = (sides: number) => Math.floor(sides / 2) + 1
export function asiAt(cls: string, level: number) {
  const n = cls.toLowerCase()
  return [4, 8, 12, 16, 19, ...(n.includes('fighter') ? [6, 14] : n.includes('rogue') ? [10] : [])].includes(level)
}
export function levelUp(c: Character, dieResult: number, now = Date.now()): Character {
  if (c.level >= 20) return c
  const level = c.level + 1
  const gain = Math.max(1, dieResult + amod(c, 'con'))
  const asi = asiAt(c.cls, level)
  let next: Character = {
    ...c, level, maxHp: c.maxHp + gain, hp: c.hp + gain, levelPing: now,
    levelTasks: { level, ...(asi ? { asi: false, feat: false } : {}), ...(c.caster ? { spells: false } : {}) },
  }
  if (c.caster && !c.caster.manual) {
    const s = slotsFor(c.cls, level)
    next = { ...next, caster: { ...c.caster, max: s.max, used: c.caster.used.map((u, i) => Math.min(u, s.max[i])) } }
  }
  return next
}

export const SKILLS: [string, Ability][] = [
  ['Acrobatics', 'dex'], ['Animal Handling', 'wis'], ['Arcana', 'int'], ['Athletics', 'str'], ['Deception', 'cha'], ['History', 'int'],
  ['Insight', 'wis'], ['Intimidation', 'cha'], ['Investigation', 'int'], ['Medicine', 'wis'], ['Nature', 'int'], ['Perception', 'wis'],
  ['Performance', 'cha'], ['Persuasion', 'cha'], ['Religion', 'int'], ['Sleight of Hand', 'dex'], ['Stealth', 'dex'], ['Survival', 'wis'],
]

export const charLabel = (name: string, player?: string) => (player?.trim() ? `${name} (${player.trim()})` : name)
