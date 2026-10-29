// The blacksmith: repair, kits, 3→1 upgrades, crafting from materials, merging, salvage.
import { roll, type Rng } from '../core/dice'
import type { Character, DamageType, Item, MatTier, Tier } from '../core/types'
import { armorDef } from './armor'
import { addItem, pay, removeItem, updateItem } from './character'
import {
  CRAFT_GOLD, MAT_GEAR, MAT_LABEL, MERGE_FEE_SILVER, UPGRADE_FEE, CAT_MULT, durOf, isBroken, kitDice, makeArmor, makeKit,
  makeMaterial, makeShield, makeWeapon, maxDur, nextMat, repairCost, salvageYield, shieldDef,
} from './gear'
import { TIER_LABEL, nextTier } from './tiers'

export interface Smith { ok: boolean; char: Character; msg: string; item?: Item }
const fail = (char: Character, msg: string): Smith => ({ ok: false, char, msg })

export const isGear = (it: Item) => it.kind === 'armor' || it.kind === 'weapon' || it.kind === 'shield'
export const gearKey = (it: Item) =>
  !isGear(it) || it.special || !it.tier ? null : `${it.kind}:${it.armorId ?? it.weaponId ?? it.shieldId}:${it.tier}`

export const matCount = (c: Character, m: MatTier) => c.inventory.filter((i) => i.kind === 'material' && i.mat === m).reduce((n, i) => n + i.qty, 0)
function takeMats(c: Character, m: MatTier, n: number): Character | null {
  if (matCount(c, m) < n) return null
  let left = n, out = c
  for (const it of c.inventory.filter((i) => i.kind === 'material' && i.mat === m)) {
    if (left <= 0) break
    const take = Math.min(left, it.qty)
    out = removeItem(out, it.id, take); left -= take
  }
  return out
}

/** Gold repair: pick how many points. Broken costs double per point. */
export function repairWithGold(c: Character, itemId: string, points?: number): Smith {
  const it = c.inventory.find((i) => i.id === itemId)
  if (!it || !it.tier || maxDur(it) <= 0) return fail(c, 'Pick a piece of tiered gear.')
  const missing = maxDur(it) - durOf(it)
  const n = Math.min(missing, points ?? missing)
  if (n <= 0) return fail(c, `${it.name} is already in perfect shape.`)
  const gold = repairCost(it, n)
  const paid = pay(c, gold * 10)
  if (!paid) return fail(c, `${c.name} needs ${gold}g for that repair.`)
  return { ok: true, char: updateItem(paid, itemId, { dur: durOf(it) + n }), msg: `${c.name} pays ${gold}g: ${it.name} +${n} durability.` }
}

/** Kits: same tier or higher, never on Broken gear. */
export function useKit(c: Character, kitId: string, gearId: string, rng: Rng = Math.random): Smith {
  const kit = c.inventory.find((i) => i.id === kitId)
  const g = c.inventory.find((i) => i.id === gearId)
  if (!kit || !g || !g.tier) return fail(c, 'Pick a kit and a piece of gear.')
  if (isBroken(g)) return fail(c, `${g.name} is Broken. Only the blacksmith (or Mending Steel) can fix that.`)
  const field = kit.consKey === 'field-repair'
  if (field && g.kind !== 'armor') return fail(c, 'The Field Repair Kit only works on armor.')
  const dice = field ? '1d6+2' : kit.kitTier ? kitDice(kit.kitTier, g.tier) : null
  if (!dice) return fail(c, `A ${TIER_LABEL[kit.kitTier!]} kit can't fix ${TIER_LABEL[g.tier]} gear.`)
  const n = Math.max(1, roll(dice, rng).total)
  const after = Math.min(maxDur(g), durOf(g) + n)
  return { ok: true, char: updateItem(removeItem(c, kitId, 1), gearId, { dur: after }), msg: `${kit.name} on ${g.name}: rolled ${dice} → +${after - durOf(g)} (${after}/${maxDur(g)}).` }
}

function feeCat(it: Item) {
  if (it.kind === 'weapon') return 'weapon' as const
  if (it.kind === 'shield') return shieldDef(it.shieldId)?.cat ?? 'light'
  return armorDef(it.armorId)?.cat ?? 'light'
}
export function upgradeFee(it: Item): number | null {
  if (!it.tier) return null
  const base = UPGRADE_FEE[it.tier]
  if (base == null) return null
  const cat = feeCat(it)
  return cat === 'weapon' ? base : base * CAT_MULT[cat]
}
function remake(it: Item, tier: Tier, sworn?: DamageType): Item {
  if (it.kind === 'armor') { const a = makeArmor(it.armorId!, tier); return sworn && (it.armorId === 'plate' || it.armorId === 'half-plate') && tier === 'mythic' ? { ...a, swornType: sworn } : a }
  if (it.kind === 'weapon') return makeWeapon(it.weaponId!, tier)
  return makeShield(it.shieldId!, tier)
}

/** Three of the same piece and tier → one of the next tier. Keeps the lowest durability of the three. */
export function upgrade(c: Character, ids: string[], sworn?: DamageType): Smith {
  if (ids.length !== 3) return fail(c, 'Upgrading takes three of the same piece.')
  const count = new Map<string, number>()
  ids.forEach((id) => count.set(id, (count.get(id) ?? 0) + 1))
  const rows = [...count.keys()].map((id) => c.inventory.find((i) => i.id === id))
  if (rows.some((r, i) => !r || r.qty < count.get([...count.keys()][i])!)) return fail(c, 'Those three are not all in the pack.')
  const key = gearKey(rows[0]!)
  if (!key || rows.some((r) => gearKey(r!) !== key)) return fail(c, 'All three must be the same piece and tier. Special and Named Mythic gear are not on this ladder.')
  const from = rows[0]!.tier!
  const to = nextTier(from)
  if (!to) return fail(c, `${rows[0]!.name} is already Mythic.`)
  const fee = upgradeFee(rows[0]!)!
  const paid = pay(c, fee * 10)
  if (!paid) return fail(c, `${c.name} needs ${fee}g for the upgrade.`)
  const lowest = Math.min(...ids.map((id) => durOf(c.inventory.find((i) => i.id === id)!)))
  let out = paid
  for (const [id, n] of count) out = removeItem(out, id, n)
  const made = { ...remake(rows[0]!, to, sworn), dur: lowest }
  return { ok: true, char: addItem(out, made), item: made, msg: `${c.name} pays ${fee}g: three ${TIER_LABEL[from]} → ${made.name} (durability ${lowest}, the lowest of the three).` }
}

export type CraftPick = { kind: 'armor' | 'weapon' | 'shield'; id: string }
export function craft(c: Character, mat: MatTier, pick: CraftPick, sworn?: DamageType): Smith {
  const tier = MAT_GEAR[mat]
  if (!tier) return fail(c, 'Gray material only merges. It does not craft gear.')
  if (matCount(c, mat) < 4) return fail(c, `Need 4 ${MAT_LABEL[mat]} material.`)
  const gold = CRAFT_GOLD[tier]
  const paid = pay(c, gold * 10)
  if (!paid) return fail(c, `${c.name} needs ${gold}g to craft that.`)
  const made = remake({ id: '', name: '', qty: 1, kind: pick.kind, armorId: pick.id, weaponId: pick.id, shieldId: pick.id }, tier, sworn)
  return { ok: true, char: addItem(takeMats(paid, mat, 4)!, made), item: made, msg: `${c.name} crafts ${made.name} from 4 ${MAT_LABEL[mat]} material and ${gold}g.` }
}

export function merge(c: Character, mat: MatTier): Smith {
  const up = nextMat(mat)
  if (!up) return fail(c, 'Red material is as high as it goes.')
  if (matCount(c, mat) < 3) return fail(c, `Need 3 ${MAT_LABEL[mat]} material.`)
  const paid = pay(c, MERGE_FEE_SILVER)
  if (!paid) return fail(c, `Merging costs ${MERGE_FEE_SILVER} silver.`)
  return { ok: true, char: addItem(takeMats(paid, mat, 3)!, makeMaterial(up)), msg: `Merged 3 ${MAT_LABEL[mat]} into 1 ${MAT_LABEL[up]} (${MERGE_FEE_SILVER}s).` }
}

export function craftKit(c: Character, mat: MatTier): Smith {
  const tier = MAT_GEAR[mat]
  if (!tier) return fail(c, 'Gray material does not make a kit. Merge it first.')
  if (matCount(c, mat) < 2) return fail(c, `Need 2 ${MAT_LABEL[mat]} material.`)
  const kit = makeKit(tier)
  return { ok: true, char: addItem(takeMats(c, mat, 2)!, kit), item: kit, msg: `Made a ${kit.name} from 2 ${MAT_LABEL[mat]} material.` }
}

export function salvage(c: Character, itemId: string): Smith {
  const it = c.inventory.find((i) => i.id === itemId)
  if (!it || !isGear(it) || !it.tier || it.special) return fail(c, 'Salvage tiered armor, weapons or shields. Special and Named Mythic gear stay whole.')
  const y = salvageYield(durOf(it), maxDur(it), it.tier)
  let out = removeItem(c, itemId, 1)
  for (const s of y) out = addItem(out, makeMaterial(s.mat, s.qty))
  return { ok: true, char: out, msg: `Salvaged ${it.name} into ${y.map((s) => `${s.qty}× ${MAT_LABEL[s.mat]}`).join(' and ')}.` }
}
