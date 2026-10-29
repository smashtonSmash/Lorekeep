// LoreKeep data model. Everything that is saved or synced is a plain JSON object.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}
export type Abilities = Record<Ability, number>

export const DAMAGE_TYPES = [
  'slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'lightning', 'thunder',
  'acid', 'poison', 'necrotic', 'radiant', 'force', 'psychic',
] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]
export const PHYSICAL: DamageType[] = ['slashing', 'piercing', 'bludgeoning']
export const DAMAGE_ICON: Record<DamageType, string> = {
  slashing: '🗡️', piercing: '🏹', bludgeoning: '🔨', fire: '🔥', cold: '❄️', lightning: '⚡', thunder: '💥',
  acid: '🧪', poison: '☠️', necrotic: '💀', radiant: '✨', force: '🌀', psychic: '🧠',
}

export const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed',
  'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'exhausted',
] as const
export type Condition = (typeof CONDITIONS)[number]

export const TIERS = ['green', 'blue', 'purple', 'legendary', 'mythic'] as const
export type Tier = (typeof TIERS)[number]
export type Special = 'pink' | 'black'
export type EquipSlot = 'head' | 'hands' | 'feet'
export type MatTier = 'gray' | 'green' | 'blue' | 'purple' | 'orange' | 'red'

export type ItemKind = 'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable' | 'scroll' | 'material' | 'kit' | 'misc'

export interface Item {
  id: string
  name: string
  kind: ItemKind
  qty: number
  tier?: Tier
  special?: Special
  desc?: string
  price?: number            // gold list price
  equipped?: boolean
  dur?: number              // current durability (undefined = full)
  // catalog references
  weaponId?: string
  armorId?: string
  shieldId?: string
  accId?: string
  consKey?: string
  mat?: MatTier
  kitTier?: Tier
  // weapon data
  damage?: string
  damageType?: DamageType
  ranged?: boolean
  slots?: number
  // accessory perks
  slot?: EquipSlot
  perkAc?: number
  perkRanged?: number
  perkSpell?: number
  // state
  shieldMode?: 'wielded' | 'back' | 'planted'
  coating?: { type?: DamageType; bonusDice?: string; bonusType?: DamageType; crit?: boolean }
  swornType?: DamageType
  synced?: boolean          // black gear bond
  bondedTo?: string
  atForge?: boolean         // left with the blacksmith, DM marks ready
  forSalvage?: boolean
  under?: boolean           // padded worn as under-layer
  abilityNote?: string
  spellId?: string          // spell scroll: anyone can cast it from the pack, no slot (house rule)
  heal?: string
}

export type TraitEffect = 'resistance' | 'vulnerability' | 'immunity' | 'advantage' | 'disadvantage' | 'custom'
export interface Trait { id: string; name: string; effect: TraitEffect; types?: DamageType[]; text?: string }

export interface Attack {
  id: string
  name: string
  toHit: number
  damage: string
  damageType: DamageType
  bonusDice?: string
  bonusType?: DamageType
  itemId?: string     // derived from a weapon in the pack
  ranged?: boolean
}

export interface Spell {
  id: string
  name: string
  level: number
  school: string
  time: string
  range: string
  duration: string
  conc?: boolean
  classes: string[]
  desc: string
  damage?: string      // at base level
  damageType?: DamageType
  upcast?: string      // extra dice per slot level above base
  heal?: string
  save?: Ability
  attack?: boolean
  custom?: boolean
}

export interface Caster {
  ability: Ability
  max: number[]        // slots per level 1..9
  used: number[]
  pact?: boolean
  manual?: boolean     // slots typed by hand
  known: string[]      // spell ids
  custom: Spell[]
}

export interface ActiveEffect { id: string; key: string; label: string; until: 'combat' | 'long' | 'used'; data?: Record<string, unknown> }

export interface Purse { gold: number; silver: number }

export interface Character {
  id: string
  name: string
  playerName?: string     // offline label
  ownerId?: string        // online: viewer id that plays this character
  race: string
  subrace?: string
  cls: string
  background?: string
  level: number
  abilities: Abilities    // base scores
  bonuses: Partial<Abilities> // origin bonuses on top
  hitDie: number
  maxHp: number
  hp: number
  tempHp: number
  speed: number
  acManual?: number | null
  profOverride?: number | null
  saves: Ability[]
  customSaves: { id: string; name: string; bonus: number }[]
  skills: string[]
  traits: Trait[]
  features: { name: string; desc: string }[]
  attacks: Attack[]       // hand-typed attacks; weapon attacks are derived
  inventory: Item[]
  purse: Purse
  caster?: Caster
  portrait?: string       // data: URL, user photo only
  details?: string        // appearance
  notes?: string
  conditions: Condition[]
  effects: ActiveEffect[]
  favor: Record<string, number>
  inspiration: number
  inspirationPing?: number
  levelTasks?: { level: number; asi?: boolean; feat?: boolean; spells?: boolean }
  levelPing?: number
  shrugUsed?: boolean
  sample?: boolean
  createdAt: number
}

export interface Combatant {
  id: string
  side: 'party' | 'monster'
  characterId?: string     // party: stats live on the character
  name: string
  init: number | null
  initMod: number
  // monster stats (ignored for party)
  ac: number
  maxHp: number
  hp: number
  tempHp: number
  attacks: Attack[]
  traits: Trait[]
  conditions: Condition[]
  armorText?: string
  lootTier?: Tier
  lootWeaponId?: string
  lootArmorId?: string
  srdKey?: string
  beast?: boolean
  looted?: boolean
  sample?: boolean
}

export interface LogEntry { id: string; t: number; kind: 'hit' | 'miss' | 'heal' | 'info' | 'down' | 'crit'; text: string }

export interface Encounter {
  combatants: Combatant[]
  round: number
  turnId: string | null
  log: LogEntry[]
  pendingLoot: Item[]
}

export interface Pouch { id: string; gold: number; silver: number }
export interface Chest {
  id: string
  name: string
  items: Item[]
  gold: number
  silver: number
  pouches: Pouch[]
  revealedAt?: number
  allowTake?: boolean
  closed?: boolean
  takenBy: Record<string, string>
  createdAt: number
}

export const WIKI_CATEGORIES = ['NPC', 'Location', 'Session', 'Lore', 'Item', 'Faction', 'Other'] as const
export interface WikiPage { id: string; title: string; category: (typeof WIKI_CATEGORIES)[number]; text: string; updatedAt: number; author?: string; sample?: boolean }

export interface Trade { id: string; fromId: string; toId: string; itemId: string; item: Item; qty: number; at: number }

export interface DiceRoll { id: string; expr: string; parts: { die: number; value: number }[]; mod: number; total: number; t: number; nat?: 'crit' | 'fumble' }

export interface Merchant { id: string; name: string; trade: string; personality: string; baseAdjust: number }
export interface TownPlace { id: string; name: string; hasFountain: boolean }
export interface Town {
  places: TownPlace[]
  currentId: string
  merchants: Merchant[]
  fountain: { silver: number; threshold: number | null }
  vault: { slots: number; blocks: number; items: Item[] }
  stash: { on: boolean; gold: number; silver: number; items: Item[] }
}

export interface RecapEvent { id: string; t: number; icon: string; text: string }
export interface SharedNote { text: string; author?: string; updatedAt: number }

export interface Settings {
  originBudget: number      // custom origin ability points
  allowReroll: boolean
  showSamples: boolean
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
