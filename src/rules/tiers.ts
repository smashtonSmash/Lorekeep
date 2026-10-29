// Rarity ladder. Ids stay green/blue/purple/legendary/mythic; players see Common → Mythic.
import { TIERS, type Special, type Tier } from '../core/types'

export { TIERS }
export const TIER_COLOR: Record<Tier, string> = {
  green: '#4fbf63', blue: '#4a8fe7', purple: '#a35de0', legendary: '#f08a2a', mythic: '#e5383b',
}
export const TIER_LABEL: Record<Tier, string> = {
  green: 'Common', blue: 'Rare', purple: 'Ultra Rare', legendary: 'Legendary', mythic: 'Mythic',
}
/** Beside the ladder, not steps on it. */
export const SPECIAL_COLOR: Record<Special, string> = { pink: '#e45aaa', black: '#d5d5de' }
export const SPECIAL_LABEL: Record<Special, string> = { pink: 'Special', black: 'Named Mythic' }

export const nextTier = (t: Tier): Tier | null => TIERS[TIERS.indexOf(t) + 1] ?? null
export const tierIndex = (t: Tier) => TIERS.indexOf(t)

export function rarityOf(it: { tier?: Tier; special?: Special }): { label: string; color: string } | null {
  if (it.special) return { label: SPECIAL_LABEL[it.special], color: SPECIAL_COLOR[it.special] }
  if (it.tier) return { label: TIER_LABEL[it.tier], color: TIER_COLOR[it.tier] }
  return null
}

export const RARITY_CHOICES: { id: string; label: string; color: string; tier?: Tier; special?: Special }[] = [
  ...TIERS.map((t) => ({ id: t, label: TIER_LABEL[t], color: TIER_COLOR[t], tier: t })),
  { id: 'black', label: SPECIAL_LABEL.black, color: SPECIAL_COLOR.black, special: 'black' as const },
  { id: 'pink', label: SPECIAL_LABEL.pink, color: SPECIAL_COLOR.pink, special: 'pink' as const },
]
