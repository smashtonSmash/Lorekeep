import type { BjAction, BjRound, Card } from '../rules/casino'

/** A player's seat at the DM's casino table. Players write only their own seat; the dealer's device runs the round. */
export interface Seat {
  id: string        // = character id
  name: string
  bet: number       // silver
  action?: { id: string; kind: BjAction | 'insure' | 'noinsure' }
  handled?: string  // last action id the dealer applied
}
export interface CasinoState {
  open: boolean
  game: 'blackjack'
  round: BjRound | null
  deck: Card[]
  handNo: number
  paidHand?: number
}
