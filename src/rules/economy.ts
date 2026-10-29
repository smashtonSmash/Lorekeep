// Town economy: merchant favor and prices, vault, wishing fountain, trades.
import type { Rng } from '../core/dice'
import type { Character, Item, Merchant, Town } from '../core/types'
import { uid } from '../core/types'
import { addItem, pay, removeItem } from './character'

// ---------- merchants & favor ----------
export const FAVOR_MIN = -100, FAVOR_MAX = 100
export const REFUSE_AT = -40
export const FAVOR_STEP = 5 // every 5 favor = 1% off
export const MERCHANT_TRADES = ['Blacksmith', 'Baker', 'Innkeeper', 'General store', 'Alchemist', 'Jeweler', 'Stablehand', 'Herbalist', 'Custom']
const PRESET: Record<string, [number, string]> = {
  Blacksmith: [10, 'Hammers out a price and remembers a haggle.'],
  Baker: [0, 'Flour-dusted, and happy to throw in a roll once they know you.'],
  Innkeeper: [-5, 'Keeps a room and a rumor, and rounds down for regulars.'],
  'General store': [5, 'Stocks a bit of everything and counts the coins twice.'],
  Alchemist: [10, 'The vials are priced for the work, not for your smile.'],
  Jeweler: [15, 'Starts high. Warmth is slow.'],
  Stablehand: [0, 'Would rather the horse come back sound than win the haggle.'],
  Herbalist: [0, 'Bundles herbs and talks while they tie the string.'],
}
export const DEFAULT_MERCHANTS: Merchant[] = [
  { id: 'mara', name: 'Mara Quickcoin', trade: 'General store', personality: 'Laughs at her own prices and rounds down once she likes you.', baseAdjust: -5 },
  { id: 'bram', name: 'Bram Ironthumb', trade: 'Blacksmith', personality: 'Starts high. Warmth is slow, and he remembers a haggle.', baseAdjust: 15 },
  { id: 'nessa', name: 'Nessa Vale', trade: 'Alchemist', personality: 'Quiet, exact, and unimpressed by flattery.', baseAdjust: 5 },
  { id: 'odo', name: 'Odo the Open', trade: 'Innkeeper', personality: 'Would rather you come back tomorrow than win today.', baseAdjust: 0 },
]
export function newMerchant(name: string, trade: string): Merchant {
  const p = PRESET[trade]
  return { id: uid(), name: name.trim() || 'New merchant', trade: trade || 'Custom', baseAdjust: p?.[0] ?? 5, personality: p?.[1] ?? `A ${trade.toLowerCase() || 'trader'} with their own prices.` }
}
export const clampFavor = (n: number) => Math.max(FAVOR_MIN, Math.min(FAVOR_MAX, Math.round(n)))
export const favorOf = (c: Character, mId: string) => clampFavor(c.favor?.[mId] ?? 0)
/** Percent markup after favor. Higher favor → lower price. */
export const markup = (m: Merchant, favor: number) => m.baseAdjust - Math.floor(clampFavor(favor) / FAVOR_STEP)
export const refuses = (favor: number) => clampFavor(favor) <= REFUSE_AT
export function mood(favor: number) {
  const f = clampFavor(favor)
  if (f <= REFUSE_AT) return { emoji: '🚫', label: 'refuses to sell' }
  if (f >= 60) return { emoji: '😄', label: 'delighted' }
  if (f >= 20) return { emoji: '🙂', label: 'pleased' }
  if (f >= -19) return { emoji: '😐', label: 'neutral' }
  return { emoji: '😠', label: 'cold' }
}
/** Buy price in silver. */
export const buySilver = (gold: number, pct: number) => Math.max(1, Math.round(gold * 10 * (1 + pct / 100)))
/** Merchants buy at half list price. */
export const sellSilver = (gold: number) => Math.max(0, Math.floor(gold * 10 / 2))

export function removeMerchant(t: Town, id: string): { ok: boolean; town: Town; msg?: string } {
  if (t.merchants.length <= 1) return { ok: false, town: t, msg: 'You have to have at least one merchant.' }
  return { ok: true, town: { ...t, merchants: t.merchants.filter((m) => m.id !== id) } }
}

// ---------- vault ----------
export const VAULT_START = 10, VAULT_BLOCK = 5
export const vaultPrice = (blocks: number) => 2 ** Math.max(0, blocks) // 1, 2, 4, 8, 16 ...
export function buyVaultSlots(c: Character, t: Town) {
  const g = vaultPrice(t.vault.blocks)
  const paid = pay(c, g * 10)
  if (!paid) return { ok: false, char: c, town: t, msg: `${c.name} needs ${g}g for 5 more vault slots.` }
  return { ok: true, char: paid, town: { ...t, vault: { ...t.vault, slots: t.vault.slots + VAULT_BLOCK, blocks: t.vault.blocks + 1 } }, msg: `${c.name} pays ${g}g. The vault holds ${t.vault.slots + VAULT_BLOCK} now.` }
}
export function deposit(c: Character, t: Town, itemId: string) {
  const it = c.inventory.find((i) => i.id === itemId)
  if (!it) return { ok: false, char: c, town: t, msg: 'Not in the pack.' }
  if (t.vault.items.length >= t.vault.slots) return { ok: false, char: c, town: t, msg: `The vault is full (${t.vault.slots} slots).` }
  return { ok: true, char: removeItem(c, itemId), town: { ...t, vault: { ...t.vault, items: [...t.vault.items, { ...it, equipped: false, under: false }] } }, msg: `${it.name} is in the vault.` }
}
export function withdraw(c: Character, t: Town, itemId: string) {
  const it = t.vault.items.find((i) => i.id === itemId)
  if (!it) return { ok: false, char: c, town: t, msg: 'Not in the vault.' }
  return { ok: true, char: addItem(c, it), town: { ...t, vault: { ...t.vault, items: t.vault.items.filter((i) => i.id !== itemId) } }, msg: `${c.name} takes ${it.name}.` }
}

// ---------- fountain ----------
export const FOUNTAIN_THRESHOLDS = [10, 50, 100, 200]
export const pickThreshold = (rng: Rng = Math.random) => FOUNTAIN_THRESHOLDS[Math.floor(rng() * FOUNTAIN_THRESHOLDS.length)]
/** Coins are kept. When the secret gold threshold is met, a placeholder gift drops and the secret re-rolls. */
export function offer(f: Town['fountain'], silver: number, rng: Rng = Math.random): { fountain: Town['fountain']; granted: boolean } {
  const threshold = f.threshold ?? pickThreshold(rng)
  const total = f.silver + Math.max(0, Math.floor(silver))
  if (total >= threshold * 10) return { granted: true, fountain: { silver: 0, threshold: pickThreshold(rng) } }
  return { granted: false, fountain: { silver: total, threshold } }
}
export const fountainGift = (): Item => ({ id: uid(), name: 'Fountain Gift (TBD)', kind: 'misc', qty: 1, desc: 'PLACEHOLDER reward — the real prize is not designed yet.' })

// ---------- trades (receiver must accept) ----------
export function acceptTrade(from: Character, to: Character, itemId: string, qty: number) {
  const it = from.inventory.find((i) => i.id === itemId)
  if (!it) return null // giver no longer has it
  const n = Math.min(qty, it.qty)
  return { from: removeItem(from, itemId, n), to: addItem(to, { ...it, qty: n, equipped: false, under: false, id: uid() }) }
}
