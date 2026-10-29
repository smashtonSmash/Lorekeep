// One attack, start to finish: to-hit vs AC (per damage type), damage parts, reductions, resistances, armor wear.
import { roll, rollDie, type Rng } from '../core/dice'
import type { DamageType, Trait } from '../core/types'
import type { ArmorStats } from './armor'
import { WEAR } from './gear'

export interface Defender {
  name: string
  acFor: (type: DamageType, beastAttacker: boolean) => number
  traits: Trait[]
  armor?: ArmorStats          // party members only
  stoneskin?: boolean
  mirrorType?: DamageType     // Mirror Oil: incoming damage becomes this type
}

export interface AttackInput {
  toHit: number
  damage: string
  damageType: DamageType
  bonusDice?: string
  bonusType?: DamageType
  beast?: boolean
  adv?: 'adv' | 'dis' | null
  d20?: number                // typed by hand ("rolled at the table")
  forceCrit?: boolean         // Whetstone Oil
  autoHit?: boolean           // save spells / heals skip the roll
  damageOverride?: number     // typed by hand
  halfDamage?: boolean        // made the save
}

export interface Part { type: DamageType; raw: number; final: number; why: string[] }
export interface AttackResult {
  d20s: number[]
  natural: number
  total: number
  ac: number
  hit: boolean
  crit: boolean
  parts: Part[]
  damage: number
  deflected: boolean
  wear: { amount: number; reason: string } | null
  weaponWear: number
  log: string
}

export function traitMultiplier(traits: Trait[], type: DamageType): { mult: number; why?: string } {
  const has = (e: Trait['effect']) => traits.some((t) => t.effect === e && (t.types ?? []).includes(type))
  if (has('immunity')) return { mult: 0, why: 'immune' }
  const r = has('resistance'), v = has('vulnerability')
  if (r && v) return { mult: 1 }
  if (r) return { mult: 0.5, why: 'resistant' }
  if (v) return { mult: 2, why: 'vulnerable' }
  return { mult: 1 }
}

export function resolveAttack(a: AttackInput, d: Defender, rng: Rng = Math.random): AttackResult {
  const type = d.mirrorType ?? a.damageType
  const ac = d.acFor(type, !!a.beast)
  let d20s: number[] = []
  let natural = 20
  if (!a.autoHit) {
    if (a.d20) d20s = [a.d20]
    else d20s = a.adv ? [rollDie(20, rng), rollDie(20, rng)] : [rollDie(20, rng)]
    natural = a.adv === 'adv' ? Math.max(...d20s) : a.adv === 'dis' ? Math.min(...d20s) : d20s[0]
  }
  const total = natural + a.toHit
  const crit = !a.autoHit && (natural === 20 || !!a.forceCrit)
  const hit = a.autoHit || crit || (natural !== 1 && total >= ac)
  const base: AttackResult = { d20s, natural, total, ac, hit, crit, parts: [], damage: 0, deflected: false, wear: null, weaponWear: 0, log: '' }
  if (!hit) {
    base.weaponWear = WEAR.miss
    base.log = `${d.name}: miss (${natural}${fmt(a.toHit)} = ${total} vs AC ${ac})`
    return base
  }
  // damage parts
  const raw: { type: DamageType; n: number }[] = []
  if (a.damageOverride != null) raw.push({ type, n: a.damageOverride })
  else {
    raw.push({ type, n: Math.max(0, roll(a.damage, rng, { crit }).total) })
    if (a.bonusDice) raw.push({ type: d.mirrorType ?? a.bonusType ?? type, n: Math.max(0, roll(a.bonusDice, rng, { crit }).total) })
  }
  let deflected = false
  if (d.armor?.deflect && type === 'piercing' && rollDie(6, rng) === 6) deflected = true
  const parts: Part[] = raw.map(({ type: t, n }) => {
    const why: string[] = []
    let v = a.halfDamage ? Math.floor(n / 2) : n
    if (a.halfDamage) why.push('half on save')
    const red = (d.armor?.reduce[t] ?? 0) + (a.beast ? d.armor?.beastReduce ?? 0 : 0)
    if (red) { v -= red; why.push(`armor −${red}`) }
    const m = traitMultiplier(d.traits, t)
    if (m.why) { v = Math.floor(Math.max(0, v) * m.mult); why.push(m.why) }
    if (deflected) { v = 0; why.push('deflected (d6 = 6)') }
    return { type: t, raw: n, final: Math.max(0, v), why }
  })
  const damage = parts.reduce((s, p) => s + p.final, 0)
  // wear: weak = this armor has a negative AC modifier vs the type
  let wear: AttackResult['wear'] = null
  if (d.armor && d.armor.notes.length) { // only when real armor is worn
    const weak = (d.armor.acVs[type] ?? 0) < 0
    wear = crit ? { amount: WEAR.crit, reason: weak ? 'critical, weak type' : 'critical' } : weak ? { amount: WEAR.weak, reason: 'weak type' } : { amount: WEAR.hit, reason: 'hit' }
  }
  const head = a.autoHit ? `${d.name}` : `${d.name}: ${crit ? 'CRITICAL HIT' : 'hit'} (${natural}${fmt(a.toHit)} = ${total} vs AC ${ac})`
  const detail = parts.map((p) => `${p.final} ${p.type}${p.why.length ? ` [${p.why.join(', ')}]` : ''}`).join(' + ')
  return { ...base, parts, damage, deflected, wear, log: `${head} — ${damage} damage${detail ? ` (${detail})` : ''}` }
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

/** Temp HP soak first. Second Wind turns a drop to 0 into 1. */
export function takeDamage(hp: number, temp: number, dmg: number, secondWind = false) {
  const soak = Math.min(temp, dmg)
  let nextHp = hp - (dmg - soak)
  let usedSecondWind = false
  if (nextHp <= 0 && secondWind && hp > 0) { nextHp = 1; usedSecondWind = true }
  return { hp: Math.max(0, nextHp), temp: temp - soak, usedSecondWind, down: nextHp <= 0 }
}

export const heal = (hp: number, max: number, n: number) => Math.min(max, Math.max(0, hp) + Math.max(0, n))
