// Homebrew armor. Each tier's effects stack on the tiers below it, unless an effect says it replaces.
// Numbers are Ashton's; anything marked PLACEHOLDER is still being tuned.
import type { DamageType, Tier } from '../core/types'
import { TIERS } from '../core/types'
import { TIER_LABEL } from './tiers'

export type ArmorCategory = 'light' | 'medium' | 'heavy'

export type Fx =
  | { k: 'reduce'; type: DamageType; n: number | 'prof'; replace?: boolean }
  | { k: 'acVs'; types: DamageType[]; n: number; notUnder?: boolean }
  | { k: 'deflect' }                    // piercing hit: roll d6, a 6 means no damage
  | { k: 'noDeflect' }
  | { k: 'shrug'; type?: DamageType }   // once per day ignore a hit (of that type)
  | { k: 'under'; ac: number; vs?: Partial<Record<DamageType, number>>; acOnly?: boolean }
  | { k: 'reset' }                      // mythic: earlier AC-vs-type bonuses are gone
  | { k: 'beastReduce'; n: number | 'prof'; replace?: boolean }
  | { k: 'beastAc'; n: number; replace?: boolean }
  | { k: 'flat'; n: number }            // +AC against everything
  | { k: 'swear'; types: DamageType[] } // +3 vs the sworn type, −1 vs the others
  | { k: 'note'; text: string }

export interface ArmorDef {
  id: string
  name: string
  cat: ArmorCategory
  base: number
  dexCap: number | null
  stealthDis: boolean
  focus: string
  always: string[]
  tiers: Record<Tier, Fx[]>
}

const physMythic = (focus: DamageType): Fx[] => [
  { k: 'reset' },
  { k: 'acVs', types: [focus], n: 3 },
  { k: 'acVs', types: (['slashing', 'piercing', 'bludgeoning'] as DamageType[]).filter((t) => t !== focus), n: -1 },
]
const reduceLadder = (type: DamageType): Pick<Record<Tier, Fx[]>, 'green' | 'blue' | 'purple'> => ({
  green: [{ k: 'reduce', type, n: 1 }],
  blue: [{ k: 'reduce', type, n: 'prof', replace: true }],
  purple: [{ k: 'acVs', types: [type], n: 1 }],
})
const allPhys: Fx[] = [
  { k: 'reduce', type: 'bludgeoning', n: 1 }, { k: 'reduce', type: 'piercing', n: 1 }, { k: 'reduce', type: 'slashing', n: 1 },
]

export const ARMOR: ArmorDef[] = [
  {
    id: 'padded', name: 'Padded', cat: 'light', base: 11, dexCap: null, stealthDis: false, focus: 'bludgeoning',
    always: ['No stealth disadvantage', 'Can be slept in with no penalty', 'Protects against cold'],
    tiers: {
      ...reduceLadder('bludgeoning'),
      legendary: [{ k: 'under', ac: 1 }],
      mythic: [
        { k: 'reset' }, { k: 'acVs', types: ['bludgeoning'], n: 3, notUnder: true },
        { k: 'acVs', types: ['slashing', 'piercing'], n: -1, notUnder: true },
        { k: 'under', ac: 1, vs: { bludgeoning: 1 }, acOnly: true },
      ],
    },
  },
  {
    id: 'leather', name: 'Leather', cat: 'light', base: 11, dexCap: null, stealthDis: false, focus: 'slashing',
    always: ['No stealth disadvantage', 'Cannot be worn under other armor'],
    tiers: { ...reduceLadder('slashing'), legendary: [{ k: 'shrug' }], mythic: physMythic('slashing') },
  },
  {
    id: 'studded', name: 'Studded Leather', cat: 'light', base: 11, dexCap: null, stealthDis: false, focus: 'piercing',
    always: ['No stealth disadvantage'],
    tiers: {
      green: [{ k: 'reduce', type: 'piercing', n: 1 }],
      blue: [{ k: 'acVs', types: ['piercing'], n: 1 }],
      purple: [{ k: 'deflect' }],
      legendary: [{ k: 'acVs', types: ['slashing', 'piercing', 'bludgeoning'], n: 1 }, { k: 'noDeflect' }],
      mythic: physMythic('piercing'),
    },
  },
  {
    id: 'hide', name: 'Hide', cat: 'medium', base: 12, dexCap: 2, stealthDis: false, focus: 'beasts and cold',
    always: ['Resists cold weather', 'No stealth disadvantage'],
    tiers: {
      green: [{ k: 'beastReduce', n: 1 }],
      blue: [{ k: 'beastReduce', n: 'prof', replace: true }],
      purple: [{ k: 'beastAc', n: 1 }],
      legendary: [{ k: 'note', text: 'Advantage on saves against being frightened by beasts.' }],
      mythic: [{ k: 'reset' }, { k: 'beastAc', n: 3, replace: true }, { k: 'acVs', types: ['bludgeoning', 'piercing', 'slashing'], n: -1 }],
    },
  },
  {
    id: 'chain-shirt', name: 'Chain Shirt', cat: 'medium', base: 13, dexCap: 2, stealthDis: false, focus: 'slashing',
    always: ['Concealable under ordinary clothes', 'No stealth disadvantage'],
    tiers: { ...reduceLadder('slashing'), legendary: [{ k: 'shrug', type: 'slashing' }], mythic: physMythic('slashing') },
  },
  {
    id: 'scale-mail', name: 'Scale Mail', cat: 'medium', base: 14, dexCap: 2, stealthDis: true, focus: 'piercing',
    always: ['Stealth disadvantage'],
    tiers: {
      green: [{ k: 'reduce', type: 'piercing', n: 1 }],
      blue: [{ k: 'acVs', types: ['piercing'], n: 1 }],
      purple: [{ k: 'note', text: 'A piercing attack that misses by 5 or more only scrapes (PLACEHOLDER flavor).' }],
      legendary: [{ k: 'note', text: 'Choose one elemental resistance (fire, cold, lightning, thunder, acid or poison) while equipped.' }],
      mythic: [...physMythic('piercing'), { k: 'note', text: 'Keeps the chosen elemental resistance.' }],
    },
  },
  {
    id: 'breastplate', name: 'Breastplate', cat: 'medium', base: 14, dexCap: 2, stealthDis: false, focus: 'crit defense',
    always: ['No stealth disadvantage'],
    tiers: {
      green: [{ k: 'note', text: 'PLACEHOLDER: a critical hit’s extra dice are reduced by one die.' }],
      blue: [{ k: 'note', text: 'Constitution save (DC 10 + half the damage) turns a critical hit into a normal hit.' }],
      purple: [{ k: 'note', text: 'PLACEHOLDER: advantage on that Constitution save.' }],
      legendary: [{ k: 'note', text: '1/day, a critical hit against you becomes a normal hit with no save.' }],
      mythic: [{ k: 'note', text: 'The first critical hit against you each day becomes a normal hit.' }],
    },
  },
  {
    id: 'half-plate', name: 'Half Plate', cat: 'medium', base: 15, dexCap: 2, stealthDis: true, focus: 'all-rounder',
    always: ['Stealth disadvantage'],
    tiers: {
      green: allPhys,
      blue: [{ k: 'note', text: 'On a short rest, pick one physical type: +1 AC against it until the next short rest.' }],
      purple: [{ k: 'acVs', types: ['bludgeoning', 'piercing', 'slashing'], n: 1 }],
      legendary: [{ k: 'note', text: 'Damaged (−1 AC) only at or below ¼ durability instead of half.' }],
      mythic: [{ k: 'reset' }, { k: 'swear', types: ['bludgeoning', 'piercing', 'slashing'] }],
    },
  },
  {
    id: 'ring-mail', name: 'Ring Mail', cat: 'heavy', base: 14, dexCap: 0, stealthDis: true, focus: 'bludgeoning',
    always: ['No Dexterity to AC', 'Stealth disadvantage'],
    tiers: { ...reduceLadder('bludgeoning'), legendary: [{ k: 'flat', n: 1 }], mythic: physMythic('bludgeoning') },
  },
  {
    id: 'chain-mail', name: 'Chain Mail', cat: 'heavy', base: 16, dexCap: 0, stealthDis: true, focus: 'slashing',
    always: ['No Dexterity to AC', 'Stealth disadvantage', 'Strength 13 to wear it well'],
    tiers: { ...reduceLadder('slashing'), legendary: [{ k: 'shrug' }], mythic: physMythic('slashing') },
  },
  {
    id: 'splint', name: 'Splint', cat: 'heavy', base: 17, dexCap: 0, stealthDis: true, focus: 'immovable',
    always: ['No Dexterity to AC', 'Stealth disadvantage', 'Strength 15 to wear it well'],
    tiers: {
      green: [{ k: 'note', text: '1/fight: advantage on saves against being shoved or knocked prone.' }],
      blue: [{ k: 'note', text: 'PLACEHOLDER: the first forced movement each fight is halved.' }],
      purple: [{ k: 'note', text: 'PLACEHOLDER: 1/fight you cannot be moved against your will.' }],
      legendary: [{ k: 'note', text: '1/day: you cannot be moved against your will.' }],
      mythic: [...physMythic('bludgeoning'), { k: 'note', text: 'Immune to forced movement 1/long rest.' }],
    },
  },
  {
    id: 'plate', name: 'Plate', cat: 'heavy', base: 18, dexCap: 0, stealthDis: true, focus: 'all-rounder',
    always: ['No Dexterity to AC', 'Stealth disadvantage', 'Strength 15 to wear it well'],
    tiers: {
      green: allPhys,
      blue: [{ k: 'flat', n: 1 }],
      purple: [{ k: 'note', text: 'PLACEHOLDER: a critical hit’s extra dice are reduced by one die.' }],
      legendary: [{ k: 'note', text: '1/day, a critical hit against you becomes a normal hit.' }],
      mythic: [{ k: 'reset' }, { k: 'swear', types: ['bludgeoning', 'piercing', 'slashing'] }, { k: 'note', text: 'Keeps the 1/day crit negation.' }],
    },
  },
]

export const armorDef = (id?: string) => ARMOR.find((a) => a.id === id)

export interface ArmorStats {
  reduce: Partial<Record<DamageType, number>>
  acVs: Partial<Record<DamageType, number>>
  flat: number
  deflect: boolean
  shrug: false | 'any' | DamageType
  under: { ac: number; vs: Partial<Record<DamageType, number>>; acOnly: boolean } | null
  beastReduce: number
  beastAc: number
  notes: string[]
}

/** Walk the ladder from Common up to `tier`, applying each step. */
export function armorStats(id: string | undefined, tier: Tier | undefined, prof: number, opts: { asUnder?: boolean; sworn?: DamageType } = {}): ArmorStats {
  const s: ArmorStats = { reduce: {}, acVs: {}, flat: 0, deflect: false, shrug: false, under: null, beastReduce: 0, beastAc: 0, notes: [] }
  const def = armorDef(id)
  if (!def || !tier) return s
  s.notes.push(...def.always)
  for (const t of TIERS.slice(0, TIERS.indexOf(tier) + 1)) {
    for (const fx of def.tiers[t]) {
      switch (fx.k) {
        case 'reduce': { const n = fx.n === 'prof' ? prof : fx.n; s.reduce[fx.type] = fx.replace ? n : (s.reduce[fx.type] ?? 0) + n; break }
        case 'acVs': if (!(opts.asUnder && fx.notUnder)) for (const ty of fx.types) s.acVs[ty] = (s.acVs[ty] ?? 0) + fx.n; break
        case 'deflect': s.deflect = true; break
        case 'noDeflect': s.deflect = false; break
        case 'shrug': s.shrug = fx.type ?? 'any'; break
        case 'under': s.under = { ac: fx.ac, vs: fx.vs ?? {}, acOnly: !!fx.acOnly }; break
        case 'reset': s.acVs = {}; break
        case 'beastReduce': { const n = fx.n === 'prof' ? prof : fx.n; s.beastReduce = fx.replace ? n : s.beastReduce + n; break }
        case 'beastAc': s.beastAc = fx.replace ? fx.n : s.beastAc + fx.n; break
        case 'flat': s.flat += fx.n; break
        case 'swear':
          if (opts.sworn && fx.types.includes(opts.sworn)) { s.acVs = {}; for (const ty of fx.types) s.acVs[ty] = ty === opts.sworn ? 3 : -1 }
          else s.notes.push(`Swear one type at the forge (${fx.types.join(', ')}): +3 AC vs it, −1 vs the other two.`)
          break
        case 'note': s.notes.push(fx.text); break
      }
    }
  }
  return s
}

export const canGoUnder = (id?: string, tier?: Tier) => !!armorStats(id, tier, 2).under

/** Main suit + optional under-layer (only beneath medium or heavy). */
export function wornArmor(main?: { armorId?: string; tier?: Tier; swornType?: DamageType }, under?: { armorId?: string; tier?: Tier }, prof = 2): ArmorStats & { underAc: number } {
  const m = armorStats(main?.armorId, main?.tier, prof, { sworn: main?.swornType })
  const mdef = armorDef(main?.armorId)
  if (!mdef || mdef.cat === 'light' || !under || !canGoUnder(under.armorId, under.tier)) return { ...m, underAc: 0 }
  const u = armorStats(under.armorId, under.tier, prof, { asUnder: true })
  const out = { ...m, reduce: { ...m.reduce }, acVs: { ...m.acVs }, notes: [...m.notes], underAc: u.under!.ac }
  if (!u.under!.acOnly) {
    for (const [t, n] of Object.entries(u.reduce)) out.reduce[t as DamageType] = Math.max(out.reduce[t as DamageType] ?? 0, n!)
    for (const [t, n] of Object.entries(u.acVs)) out.acVs[t as DamageType] = (out.acVs[t as DamageType] ?? 0) + n!
  }
  for (const [t, n] of Object.entries(u.under!.vs)) out.acVs[t as DamageType] = (out.acVs[t as DamageType] ?? 0) + n!
  return out
}

/** Readable lines for the sheet and the DM page. */
export function armorLines(s: ArmorStats & { underAc?: number }): string[] {
  const out: string[] = []
  for (const [t, n] of Object.entries(s.reduce)) out.push(`−${n} ${t} damage taken`)
  if (s.beastReduce) out.push(`−${s.beastReduce} damage from beasts`)
  for (const [t, n] of Object.entries(s.acVs)) if (n) out.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} AC vs ${t}`)
  if (s.beastAc) out.push(`+${s.beastAc} AC vs beasts`)
  if (s.flat) out.push(`+${s.flat} AC`)
  if (s.deflect) out.push('Piercing hit: roll d6, on a 6 no damage')
  if (s.shrug) out.push(`Shrug off one ${s.shrug === 'any' ? '' : s.shrug + ' '}hit per day`)
  if (s.under) out.push(`Can be worn under medium/heavy armor: +${s.under.ac} AC${s.under.acOnly ? ' (AC only)' : ''}`)
  if (s.underAc) out.push(`Under-layer adds +${s.underAc} AC`)
  return out
}

export const armorName = (id: string, tier: Tier) => `${TIER_LABEL[tier]} ${armorDef(id)?.name ?? id} Armor`
export const profForLevel = (lvl: number) => 2 + Math.floor((Math.max(1, Math.min(20, lvl)) - 1) / 4)
