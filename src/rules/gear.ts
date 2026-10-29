// Everything you can carry: weapons, shields, accessories, consumables, materials, kits, specials.
// Prices are gold. 1 gold = 10 silver. PLACEHOLDER numbers are flagged on the DM page.
import type { DamageType, EquipSlot, Item, MatTier, Tier } from '../core/types'
import { TIERS, uid } from '../core/types'
import { armorDef, armorName, type ArmorCategory } from './armor'
import { TIER_LABEL } from './tiers'

// ---------- prices & durability ----------
export const ARMOR_PRICE: Record<Tier, number> = { green: 10, blue: 35, purple: 90, legendary: 300, mythic: 1000 }
export const CAT_MULT: Record<ArmorCategory, number> = { light: 1, medium: 2, heavy: 5 }
export const ARMOR_HP: Record<ArmorCategory, Record<Tier, number>> = {
  light: { green: 15, blue: 20, purple: 26, legendary: 36, mythic: 48 },
  medium: { green: 22, blue: 30, purple: 40, legendary: 54, mythic: 72 },
  heavy: { green: 30, blue: 40, purple: 52, legendary: 72, mythic: 96 },
}
export type WeaponSize = 'light' | 'standard' | 'heavy'
export const WEAPON_HP: Record<WeaponSize, Record<Tier, number>> = {
  light: { green: 8, blue: 12, purple: 16, legendary: 22, mythic: 30 },
  standard: { green: 12, blue: 16, purple: 22, legendary: 30, mythic: 40 },
  heavy: { green: 16, blue: 22, purple: 30, legendary: 42, mythic: 56 },
}
export const WEAPON_PRICE: Record<Tier, number> = { green: 8, blue: 25, purple: 70, legendary: 220, mythic: 800 }
export const WEAPON_FLAT: Record<Tier, number> = { green: 0, blue: 1, purple: 1, legendary: 2, mythic: 3 }
export const WEAR = { hit: 1, weak: 2, crit: 3, miss: 1 }
export const DAMAGED_AT = 0.5
export const SALVAGE_RICH_ABOVE = 0.65
export const REPAIR_PER_POINT: Record<Tier, number> = { green: 1, blue: 1, purple: 3, legendary: 10, mythic: 25 }
export const BROKEN_MULT = 2
export const UPGRADE_FEE: Partial<Record<Tier, number>> = { green: 5, blue: 15, purple: 50, legendary: 150 }
export const CRAFT_GOLD: Record<Tier, number> = { green: 1, blue: 5, purple: 15, legendary: 50, mythic: 150 }
export const MERGE_FEE_SILVER = 1
export const KIT_DICE: Record<Tier, string> = { green: '1d6+2', blue: '1d6+4', purple: '1d8+4', legendary: '1d8+6', mythic: '1d10+6' }
export const KIT_PRICE: Record<Tier, number> = { green: 12, blue: 25, purple: 50, legendary: 120, mythic: 280 }

export const armorPrice = (id: string, tier: Tier) => Math.round(ARMOR_PRICE[tier] * CAT_MULT[armorDef(id)?.cat ?? 'light'])

// ---------- weapons ----------
export interface WeaponDef { id: string; name: string; damage: string; type: DamageType; ranged: boolean; finesse: boolean; size: WeaponSize; slots: number }
export const WEAPONS: WeaponDef[] = [
  { id: 'dagger', name: 'Dagger', damage: '1d4', type: 'piercing', ranged: false, finesse: true, size: 'light', slots: 1 },
  { id: 'handaxe', name: 'Handaxe', damage: '1d6', type: 'slashing', ranged: false, finesse: false, size: 'light', slots: 1 },
  { id: 'shortsword', name: 'Shortsword', damage: '1d6', type: 'piercing', ranged: false, finesse: true, size: 'light', slots: 1 },
  { id: 'longsword', name: 'Longsword', damage: '1d8', type: 'slashing', ranged: false, finesse: false, size: 'standard', slots: 1 },
  { id: 'rapier', name: 'Rapier', damage: '1d8', type: 'piercing', ranged: false, finesse: true, size: 'standard', slots: 1 },
  { id: 'mace', name: 'Mace', damage: '1d6', type: 'bludgeoning', ranged: false, finesse: false, size: 'standard', slots: 1 },
  { id: 'warhammer', name: 'Warhammer', damage: '1d8', type: 'bludgeoning', ranged: false, finesse: false, size: 'standard', slots: 1 },
  { id: 'shortbow', name: 'Shortbow', damage: '1d6', type: 'piercing', ranged: true, finesse: false, size: 'standard', slots: 1 },
  { id: 'longbow', name: 'Longbow', damage: '1d8', type: 'piercing', ranged: true, finesse: false, size: 'heavy', slots: 2 },
  { id: 'greataxe', name: 'Greataxe', damage: '1d12', type: 'slashing', ranged: false, finesse: false, size: 'heavy', slots: 2 },
  { id: 'greatsword', name: 'Greatsword', damage: '2d6', type: 'slashing', ranged: false, finesse: false, size: 'heavy', slots: 2 },
]
export const weaponDef = (id?: string) => WEAPONS.find((w) => w.id === id)

export function makeWeapon(id: string, tier: Tier): Item {
  const w = weaponDef(id) ?? WEAPONS[0]
  const flat = WEAPON_FLAT[tier]
  return {
    id: uid(), name: `${TIER_LABEL[tier]} ${w.name}`, kind: 'weapon', qty: 1, tier, weaponId: w.id,
    damage: flat ? `${w.damage}+${flat}` : w.damage, damageType: w.type, ranged: w.ranged, slots: w.slots,
    price: WEAPON_PRICE[tier],
    desc: `${w.ranged ? 'Ranged' : 'Melee'} · ${w.size}${w.slots > 1 ? ' · 2 slots' : ''}. Wears down on a miss, not a hit.${flat ? ` +${flat} damage (PLACEHOLDER).` : ''}`,
  }
}

export function makeArmor(id: string, tier: Tier): Item {
  const a = armorDef(id)
  return {
    id: uid(), name: armorName(id, tier), kind: 'armor', qty: 1, tier, armorId: id, price: armorPrice(id, tier), slots: 1,
    desc: a ? `${a.cat} armor · AC ${a.base}${a.dexCap === null ? ' + Dex' : a.dexCap ? ` + Dex (max ${a.dexCap})` : ''} · ${a.focus}` : undefined,
  }
}

// ---------- shields ----------
export interface ShieldDef { id: string; name: string; cat: ArmorCategory; ac: Record<Tier, number>; fillsHand: boolean; bash?: Record<Tier, string>; rules: Record<Tier, string[]> }
export const SHIELDS: ShieldDef[] = [
  {
    id: 'small', name: 'Small Shield', cat: 'light', fillsHand: false, ac: { green: 0, blue: 1, purple: 1, legendary: 1, mythic: 2 },
    rules: {
      green: ['Fine beside a one-handed weapon.', 'When attacked, roll 1d4: on a 4, +1 AC against that attack.'],
      blue: ['+1 AC.'],
      purple: ['+1 AC.', 'Parry: roll 1d4; on a 4, +1 AC and no damage if it still hits.'],
      legendary: ['+1 AC.', 'Parry on a 3–4.', '1/day reflect a ranged attack back at the attacker.'],
      mythic: ['+2 AC.', 'Parry on a 2–4.'],
    },
  },
  {
    id: 'medium', name: 'Medium Shield', cat: 'medium', fillsHand: false, ac: { green: 2, blue: 2, purple: 2, legendary: 2, mythic: 3 },
    rules: {
      green: ['+2 AC.'],
      blue: ['+2 AC.', '1/short rest: disadvantage on one attack against you.'],
      purple: ['+2 AC.', 'Reaction: +2 AC to an ally within 5 ft against one attack.'],
      legendary: ['+2 AC.', 'That ally reaction also halves the damage if the attack hits.'],
      mythic: ['+3 AC.', 'The ally reaction can be used once a round.'],
    },
  },
  {
    id: 'heavy', name: 'Heavy Shield', cat: 'heavy', fillsHand: true, ac: { green: 2, blue: 2, purple: 3, legendary: 3, mythic: 3 },
    bash: { green: '1d4', blue: '1d4', purple: '1d6', legendary: '1d6', mythic: '1d8' },
    rules: {
      green: ['Fills a hand — no weapon while wielded.', 'Bash 1d4 bludgeoning.', 'On your back: −5 ft speed.', 'Planted: half cover for you and one ally.'],
      blue: ['Bash 1d4 + Str.', 'On your back: disadvantage on Stealth.', 'Planted: 1/short rest block one ranged shot.'],
      purple: ['Bash 1d6 + Str and shove 5 ft.', 'Planted: allies behind it ignore the first forced movement 1/fight.'],
      legendary: ['Bash 1d6 + Str, 1/day the bash crits if it hits.', 'No penalty on your back.', 'Planted: 1/short rest three-quarters cover for a round.'],
      mythic: ['Bash 1d8 + Str, can replace an attack.', 'Back ↔ wield is free.', 'Plant as a bonus action, +1 AC to you and the ally 1/long rest.'],
    },
  },
]
export const shieldDef = (id?: string) => SHIELDS.find((s) => s.id === id)
export const shieldPrice = (id: string, tier: Tier) => Math.round(ARMOR_PRICE[tier] * CAT_MULT[shieldDef(id)?.cat ?? 'light'])
export function makeShield(id: string, tier: Tier): Item {
  const s = shieldDef(id) ?? SHIELDS[0]
  return {
    id: uid(), name: `${TIER_LABEL[tier]} ${s.name}`, kind: 'shield', qty: 1, tier, shieldId: s.id, shieldMode: 'wielded', slots: 1,
    price: shieldPrice(s.id, tier), ...(s.bash ? { damage: s.bash[tier], damageType: 'bludgeoning' as const } : {}),
    desc: `+${s.ac[tier]} AC while wielded. ${s.rules[tier].join(' ')}`,
  }
}

// ---------- accessories (not armor layers) ----------
export interface AccDef { id: string; name: string; slot: EquipSlot; tier: Tier; price: number; perkAc?: number; perkRanged?: number; perkSpell?: number; note: string }
export const ACCESSORIES: AccDef[] = [
  { id: 'iron-cap', name: 'Iron Cap', slot: 'head', tier: 'green', price: 12, perkAc: 1, note: 'PLACEHOLDER helmet: +1 AC. Not an under-layer.' },
  { id: 'archer-gauntlets', name: "Archer's Gauntlets", slot: 'hands', tier: 'blue', price: 40, perkRanged: 1, perkSpell: 1, note: 'PLACEHOLDER: +1 to hit with ranged weapons and spell attacks.' },
  { id: 'softstep-boots', name: 'Softstep Boots', slot: 'feet', tier: 'green', price: 18, note: 'PLACEHOLDER boots: quiet steps. No AC.' },
]
export function makeAccessory(id: string): Item {
  const a = ACCESSORIES.find((x) => x.id === id) ?? ACCESSORIES[0]
  return { id: uid(), name: `${TIER_LABEL[a.tier]} ${a.name}`, kind: 'accessory', qty: 1, tier: a.tier, accId: a.id, slot: a.slot, price: a.price, perkAc: a.perkAc, perkRanged: a.perkRanged, perkSpell: a.perkSpell, desc: a.note }
}

// ---------- consumables ----------
export type Use =
  | { k: 'heal'; dice: string } | { k: 'fullHeal' }
  | { k: 'coatType'; type: DamageType } | { k: 'coatBonus'; dice: string; type: DamageType } | { k: 'whetstone' }
  | { k: 'effect'; key: string; until: 'combat' | 'long' | 'used' } | { k: 'repair'; dice: string } | { k: 'note' }

export interface Consumable { key: string; name: string; tier: Tier; scroll?: boolean; price: number; desc: string; use: Use }
export const CONSUMABLES: Consumable[] = [
  { key: 'heal-green', name: 'Healing Potion', tier: 'green', price: 10, desc: 'Regain 2d6+2 HP.', use: { k: 'heal', dice: '2d6+2' } },
  { key: 'oil-slashing', name: 'Oil of Slashing', tier: 'green', price: 8, desc: 'Your weapon deals slashing until the next long rest.', use: { k: 'coatType', type: 'slashing' } },
  { key: 'oil-piercing', name: 'Oil of Piercing', tier: 'green', price: 8, desc: 'Your weapon deals piercing until the next long rest.', use: { k: 'coatType', type: 'piercing' } },
  { key: 'oil-bludgeoning', name: 'Oil of Bludgeoning', tier: 'green', price: 8, desc: 'Your weapon deals bludgeoning until the next long rest.', use: { k: 'coatType', type: 'bludgeoning' } },
  { key: 'liquid-courage', name: 'Liquid Courage', tier: 'green', price: 5, desc: 'Advantage on saves vs frightened, disadvantage on WIS checks. 1 hour.', use: { k: 'effect', key: 'courage', until: 'long' } },
  { key: 'featherfoot', name: 'Featherfoot Tonic', tier: 'green', price: 10, desc: 'No fall damage and silent steps. 1 hour.', use: { k: 'effect', key: 'featherfoot', until: 'long' } },
  { key: 'ember-flask', name: 'Ember Flask', tier: 'green', price: 10, desc: 'Throw for a 10 ft fire area, or pour on a weapon for +1d4 fire until the next long rest.', use: { k: 'coatBonus', dice: '1d4', type: 'fire' } },
  { key: 'beastblood', name: 'Beastblood Brew', tier: 'green', price: 12, desc: 'Speak with one kind of animal. 1 hour.', use: { k: 'effect', key: 'beastblood', until: 'long' } },
  { key: 'clear-eyes', name: 'Potion of Clear Eyes', tier: 'green', price: 12, desc: 'Darkvision and see invisible outlines. 10 minutes.', use: { k: 'effect', key: 'clear-eyes', until: 'combat' } },
  { key: 'field-repair', name: 'Field Repair Kit', tier: 'green', price: 15, desc: 'Short rest: restore 1d6+2 durability to one armor (not Broken).', use: { k: 'repair', dice: '1d6+2' } },
  { key: 'borrowed-skill', name: 'Scroll of Borrowed Skill', tier: 'green', scroll: true, price: 15, desc: 'Proficiency in one skill or tool. 1 hour.', use: { k: 'effect', key: 'borrowed-skill', until: 'long' } },
  { key: 'heal-blue', name: 'Healing Potion', tier: 'blue', price: 35, desc: 'Regain 4d8+4 HP.', use: { k: 'heal', dice: '4d8+4' } },
  { key: 'frostbite', name: 'Frostbite Salve', tier: 'blue', price: 30, desc: 'Melee attackers who hit you take 1d4 cold.', use: { k: 'effect', key: 'frostbite', until: 'long' } },
  { key: 'thunderclap', name: 'Scroll of Thunderclap', tier: 'blue', scroll: true, price: 30, desc: 'Knock all creatures within 10 ft back 15 ft.', use: { k: 'note' } },
  { key: 'ironhide', name: 'Ironhide Draught', tier: 'blue', price: 35, desc: '+2 AC and −10 ft speed for the fight.', use: { k: 'effect', key: 'ironhide', until: 'combat' } },
  { key: 'marked-prey', name: 'Scroll of Marked Prey', tier: 'blue', scroll: true, price: 35, desc: "Know the marked creature's location. 1 day.", use: { k: 'effect', key: 'marked-prey', until: 'long' } },
  { key: 'stoneskin', name: 'Stoneskin Mud', tier: 'blue', price: 40, desc: "Removes Mythic armor's −1 AC penalties until the next long rest.", use: { k: 'effect', key: 'stoneskin', until: 'long' } },
  { key: 'safe-haven', name: 'Scroll of Safe Haven', tier: 'blue', scroll: true, price: 45, desc: "A hidden hut for one long rest that enemies can't find.", use: { k: 'note' } },
  { key: 'heal-purple', name: 'Healing Potion', tier: 'purple', price: 100, desc: 'Regain 8d8+8 HP.', use: { k: 'heal', dice: '8d8+8' } },
  { key: 'last-word', name: 'Scroll of the Last Word', tier: 'purple', scroll: true, price: 75, desc: 'A dying creature answers 3 questions.', use: { k: 'note' } },
  { key: 'whetstone', name: 'Whetstone Oil', tier: 'purple', price: 80, desc: "Your weapon's next hit that day is a crit.", use: { k: 'whetstone' } },
  { key: 'swap', name: 'Scroll of Swap', tier: 'purple', scroll: true, price: 90, desc: 'Trade places with a creature within 30 ft (DC 13 CHA save if unwilling).', use: { k: 'note' } },
  { key: 'mirror-1min', name: 'Mirror Oil (1 min)', tier: 'purple', price: 100, desc: "Attacks against you deal your weapon's damage type. 1 fight.", use: { k: 'effect', key: 'mirror', until: 'combat' } },
  { key: 'mending-steel', name: 'Scroll of Mending Steel', tier: 'purple', scroll: true, price: 120, desc: 'Repairs your armor (even Broken) and raises it one tier for one fight.', use: { k: 'effect', key: 'mending', until: 'combat' } },
  { key: 'heal-legendary', name: 'Healing Potion', tier: 'legendary', price: 300, desc: 'Full heal.', use: { k: 'fullHeal' } },
  { key: 'second-wind', name: 'Second Wind Elixir', tier: 'legendary', price: 300, desc: "The next time you'd drop to 0 HP, drop to 1 instead.", use: { k: 'effect', key: 'second-wind', until: 'used' } },
  { key: 'rewind', name: 'Scroll of Rewind', tier: 'legendary', scroll: true, price: 350, desc: 'Reroll one attack, save or check after seeing the result.', use: { k: 'effect', key: 'rewind', until: 'used' } },
  { key: 'mirror-long', name: 'Mirror Oil', tier: 'legendary', price: 400, desc: "Attacks against you deal your weapon's damage type until the next long rest.", use: { k: 'effect', key: 'mirror', until: 'long' } },
]
export const consumable = (key?: string) => CONSUMABLES.find((c) => c.key === key)
export const consumableName = (c: Consumable) => (c.name === 'Healing Potion' ? `${TIER_LABEL[c.tier]} Healing Potion` : c.name)
export function makeConsumable(key: string, qty = 1): Item {
  const c = consumable(key) ?? CONSUMABLES[0]
  return { id: uid(), name: consumableName(c), kind: c.scroll ? 'scroll' : 'consumable', qty, tier: c.tier, consKey: c.key, price: c.price, desc: c.desc }
}

// ---------- materials & kits ----------
export const MATS: MatTier[] = ['gray', 'green', 'blue', 'purple', 'orange', 'red']
export const MAT_COLOR: Record<MatTier, string> = { gray: '#9aa0a8', green: '#4fbf63', blue: '#4a8fe7', purple: '#a35de0', orange: '#f08a2a', red: '#e5383b' }
export const MAT_LABEL: Record<MatTier, string> = { gray: 'Gray', green: 'Green', blue: 'Blue', purple: 'Purple', orange: 'Orange', red: 'Red' }
export const GEAR_MAT: Record<Tier, MatTier> = { green: 'green', blue: 'blue', purple: 'purple', legendary: 'orange', mythic: 'red' }
export const MAT_GEAR: Partial<Record<MatTier, Tier>> = { green: 'green', blue: 'blue', purple: 'purple', orange: 'legendary', red: 'mythic' }
export const nextMat = (m: MatTier) => MATS[MATS.indexOf(m) + 1] ?? null
export const prevMat = (m: MatTier) => MATS[MATS.indexOf(m) - 1] ?? null

export function makeMaterial(mat: MatTier, qty = 1): Item {
  const g = MAT_GEAR[mat]
  return {
    id: uid(), name: `${MAT_LABEL[mat]} Material`, kind: 'material', qty, mat,
    desc: g ? `4 + ${CRAFT_GOLD[g]}g craft ${TIER_LABEL[g]} gear. 3 merge up a tier. 2 make a repair kit.` : 'Merge three into one Green. Gray does not craft gear.',
  }
}
export function makeKit(tier: Tier): Item {
  return {
    id: uid(), name: `${TIER_LABEL[tier]} Repair Kit`, kind: 'kit', qty: 1, tier, kitTier: tier, price: KIT_PRICE[tier],
    desc: `Restores ${KIT_DICE[tier]} durability to ${TIER_LABEL[tier]} gear (one die step bigger on lower tiers). Cannot fix Broken gear.`,
  }
}

// ---------- specials (beside the ladder) ----------
export const SPECIALS: Record<string, () => Item> = {
  lantern: () => ({ id: uid(), name: 'Lantern of the Last Road', kind: 'misc', qty: 1, special: 'pink', desc: 'Special unique — not above Mythic.', abilityNote: 'PLACEHOLDER: once per long rest, shows one hidden path.' }),
  coin: () => ({ id: uid(), name: "Gambler's Pink Coin", kind: 'misc', qty: 1, special: 'pink', desc: 'Special unique — not above Mythic.', abilityNote: 'PLACEHOLDER: once per day, reroll one haggle.' }),
  whisperfang: () => ({ id: uid(), name: 'Whisperfang', kind: 'weapon', qty: 1, special: 'black', synced: false, damage: '1d8', damageType: 'slashing', slots: 1, desc: 'Named Mythic with a will of its own. Must be synced to its owner to be drawn.', abilityNote: 'PLACEHOLDER: while synced it may refuse a dishonorable strike.' }),
}

// ---------- durability ----------
export function maxDur(it: Item): number {
  if (it.kind === 'weapon' && it.special === 'black') return WEAPON_HP[weaponDef(it.weaponId)?.size ?? 'standard'].mythic
  if (it.special || !it.tier) return 0
  if (it.kind === 'armor') return ARMOR_HP[armorDef(it.armorId)?.cat ?? 'light'][it.tier]
  if (it.kind === 'shield') return ARMOR_HP[shieldDef(it.shieldId)?.cat ?? 'light'][it.tier]
  if (it.kind === 'weapon') return WEAPON_HP[weaponDef(it.weaponId)?.size ?? 'standard'][it.tier]
  return 0
}
export const durOf = (it: Item) => Math.max(0, Math.min(maxDur(it), it.dur ?? maxDur(it)))
export const isBroken = (it: Item) => maxDur(it) > 0 && durOf(it) <= 0
export const damagedLine = (it: Item) => (it.kind === 'armor' && it.armorId === 'half-plate' && (it.tier === 'legendary' || it.tier === 'mythic') ? 0.25 : DAMAGED_AT)
export const isDamaged = (it: Item) => (it.kind === 'armor' || it.kind === 'shield') && maxDur(it) > 0 && !isBroken(it) && durOf(it) <= maxDur(it) * damagedLine(it)
export const durState = (it: Item) => (isBroken(it) ? 'broken' : isDamaged(it) ? 'damaged' : 'ok')

export function repairCost(it: Item, points: number) {
  return it.tier ? points * REPAIR_PER_POINT[it.tier] * (isBroken(it) ? BROKEN_MULT : 1) : 0
}

const DIE_STEPS = [4, 6, 8, 10, 12]
export const bumpDie = (expr: string) => expr.replace(/d(\d+)/, (_, n) => `d${DIE_STEPS[Math.min(4, DIE_STEPS.indexOf(+n) + 1)] ?? n}`)
export function kitDice(kit: Tier, gear: Tier): string | null {
  if (TIERS.indexOf(kit) < TIERS.indexOf(gear)) return null
  return kit === gear ? KIT_DICE[kit] : bumpDie(KIT_DICE[kit])
}

/** Salvage by remaining durability: broken 1 mat, up to 65% 2 mats, above that 2 + 2 of the tier below. */
export function salvageYield(cur: number, max: number, tier: Tier): { mat: MatTier; qty: number }[] {
  if (max <= 0) return []
  const m = GEAR_MAT[tier]
  if (cur <= 0) return [{ mat: m, qty: 1 }]
  if (cur / max <= SALVAGE_RICH_ABOVE) return [{ mat: m, qty: 2 }]
  const below = prevMat(m)
  return below ? [{ mat: m, qty: 2 }, { mat: below, qty: 2 }] : [{ mat: m, qty: 2 }]
}

/** Any item's list price in gold. */
export function priceOf(it: Item): number {
  if (it.price != null) return it.price
  if (it.kind === 'armor' && it.tier && it.armorId) return armorPrice(it.armorId, it.tier)
  return consumable(it.consKey)?.price ?? 0
}

/** Item slots (Shadowdark style). Identical potions share one row = one slot. */
export function slotsOf(it: Item): number {
  if (typeof it.slots === 'number') return it.slots
  if (it.kind === 'weapon') return weaponDef(it.weaponId)?.slots ?? (/great|maul|pike|halberd/i.test(it.name) ? 2 : 1)
  return 1
}

export const stackKey = (it: Item) =>
  it.kind === 'consumable' || it.kind === 'scroll' ? `c:${it.consKey ?? it.name}` : it.kind === 'material' ? `m:${it.mat}` : it.kind === 'kit' ? `k:${it.kitTier}` : null
