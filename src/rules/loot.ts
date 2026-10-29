// Monster rarity pies and coin splitting. Nothing drops just because HP hits 0 — the DM rolls.
import type { Rng } from '../core/dice'
import type { Item, MatTier, Tier } from '../core/types'
import { makeArmor, makeMaterial, makeWeapon, WEAPONS } from './gear'
import { armorDef } from './armor'

type Slice = { w: number; mat: MatTier } | { w: number; gear: Tier }
export const PIES: Record<Exclude<Tier, 'mythic'>, { drop: number; slices: Slice[] }> = {
  green: { drop: 0.2, slices: [{ w: 70, mat: 'gray' }, { w: 5, mat: 'green' }, { w: 25, gear: 'green' }] },
  blue: { drop: 0.3, slices: [{ w: 35, mat: 'gray' }, { w: 15, mat: 'green' }, { w: 15, mat: 'blue' }, { w: 20, gear: 'green' }, { w: 15, gear: 'blue' }] },
  purple: { drop: 0.4, slices: [{ w: 15, mat: 'green' }, { w: 20, mat: 'blue' }, { w: 20, mat: 'purple' }, { w: 10, gear: 'green' }, { w: 15, gear: 'blue' }, { w: 20, gear: 'purple' }] },
  legendary: { drop: 0.6, slices: [{ w: 10, gear: 'green' }, { w: 30, gear: 'blue' }, { w: 30, gear: 'purple' }, { w: 30, gear: 'legendary' }] },
}
export const MYTHIC_RULE = 'Always one Legendary piece, plus a 50% chance of an extra Mythic piece.'

export function guessTier(name: string): Tier {
  const n = name.toLowerCase()
  if (/ancient|tarrasque|titan|lich|greatwyrm|kraken/.test(n)) return 'mythic'
  if (/dragon|beholder|vampire|demon|devil|balor|pit fiend/.test(n)) return 'legendary'
  if (/ogre|troll|giant|wyvern|owlbear|minotaur|manticore/.test(n)) return 'purple'
  if (/orc|hobgoblin|gnoll|bugbear|lizardfolk|veteran/.test(n)) return 'blue'
  return 'green'
}

const ARMOR_WORDS: [string, RegExp][] = [
  ['studded', /studded/i], ['half-plate', /half[\s-]*plate/i], ['breastplate', /breastplate/i], ['chain-shirt', /chain[\s-]*shirt/i],
  ['chain-mail', /chain[\s-]*mail|chainmail/i], ['scale-mail', /scale/i], ['ring-mail', /ring[\s-]*mail/i], ['splint', /splint/i],
  ['plate', /\bplate\b/i], ['leather', /leather/i], ['padded', /padded/i], ['hide', /\bhide\b/i],
]
export interface Loadout { weaponId?: string; armorId?: string }
/** What a monster is carrying, from its attack names and armor line (or the DM's override). */
export function inferLoadout(m: { attacks?: { name: string }[]; armorText?: string; lootWeaponId?: string; lootArmorId?: string }): Loadout {
  let weaponId = m.lootWeaponId
  if (!weaponId) {
    const sorted = [...WEAPONS].sort((a, b) => b.name.length - a.name.length)
    for (const atk of m.attacks ?? []) { const w = sorted.find((x) => atk.name.toLowerCase().includes(x.name.toLowerCase())); if (w) { weaponId = w.id; break } }
  }
  let armorId = m.lootArmorId
  if (!armorId && m.armorText) armorId = ARMOR_WORDS.find(([, re]) => re.test(m.armorText!))?.[0]
  if (armorId && armorDef(armorId)?.cat === 'light') armorId = undefined // light = even split
  return { weaponId, armorId }
}

const LIGHT = ['padded', 'leather', 'studded']
function gear(tier: Tier, load: Loadout, rng: Rng): Item {
  if (load.weaponId && rng() < 0.5) return makeWeapon(load.weaponId, tier)
  if (load.armorId) return makeArmor(load.armorId, tier)
  return makeArmor(LIGHT[Math.floor(rng() * 3)], tier)
}

export function rollLoot(tier: Tier, load: Loadout, rng: Rng = Math.random): Item[] {
  if (tier === 'mythic') {
    const out = [gear('legendary', load, rng)]
    if (rng() < 0.5) out.push(gear('mythic', load, rng))
    return out
  }
  const pie = PIES[tier]
  if (rng() >= pie.drop) return []
  const total = pie.slices.reduce((s, x) => s + x.w, 0)
  let r = rng() * total
  const slice = pie.slices.find((s) => (r -= s.w) <= 0) ?? pie.slices[pie.slices.length - 1]
  return ['mat' in slice ? makeMaterial(slice.mat) : gear(slice.gear, load, rng)]
}

/** Split coin evenly in silver. Leftover silver stays in the chest. */
export function splitCoins(gold: number, silver: number, n: number) {
  const total = gold * 10 + silver
  if (n <= 0) return { each: 0, leftover: total }
  const each = Math.floor(total / n)
  return { each, leftover: total - each * n }
}
