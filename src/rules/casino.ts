// Casino games. Pure functions so the dealer's device (or solo mode) can run them.
import type { Rng } from '../core/dice'

// ---------- cards ----------
export interface Card { r: string; s: '♠' | '♥' | '♦' | '♣' }
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Card['s'][] = ['♠', '♥', '♦', '♣']
export function shoe(decks = 6, rng: Rng = Math.random): Card[] {
  const out: Card[] = []
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) out.push({ r, s })
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0
  for (const c of cards) { if (c.r === 'A') { aces++; total += 11 } else total += ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r }
  while (total > 21 && aces) { total -= 10; aces-- }
  return { total, soft: aces > 0 }
}
export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21
export const isRed = (c: Card) => c.s === '♥' || c.s === '♦'

// ---------- blackjack round ----------
export interface BjHand { cards: Card[]; bet: number; done: boolean; doubled?: boolean; fromSplit?: boolean; result?: 'win' | 'lose' | 'push' | 'blackjack'; payout?: number }
export interface BjSeat { id: string; name: string; hands: BjHand[]; active: number; insurance?: number }
export interface BjRound { deck: Card[]; dealer: Card[]; seats: BjSeat[]; turn: number; phase: 'betting' | 'insurance' | 'playing' | 'dealer' | 'done'; hideHole: boolean }

/** Bets are in silver. */
export function deal(seats: { id: string; name: string; bet: number }[], deck: Card[], rng: Rng = Math.random): BjRound {
  let d = deck.length < 60 ? shoe(6, rng) : [...deck]
  const draw = () => { if (!d.length) d = shoe(6, rng); return d.pop()! }
  const ss: BjSeat[] = seats.filter((s) => s.bet > 0).map((s) => ({ id: s.id, name: s.name, active: 0, hands: [{ cards: [], bet: s.bet, done: false }] }))
  const dealer: Card[] = []
  for (let k = 0; k < 2; k++) { for (const s of ss) s.hands[0].cards.push(draw()); dealer.push(draw()) }
  for (const s of ss) if (isBlackjack(s.hands[0].cards)) s.hands[0].done = true
  const r: BjRound = { deck: d, dealer, seats: ss, turn: 0, phase: dealer[0].r === 'A' ? 'insurance' : 'playing', hideHole: true }
  return r.phase === 'playing' ? advance(r) : r
}

export function insure(r: BjRound, seatId: string, take: boolean): BjRound {
  const seats = r.seats.map((s) => (s.id === seatId ? { ...s, insurance: take ? Math.floor(s.hands[0].bet / 2) : 0 } : s))
  const all = seats.every((s) => s.insurance !== undefined)
  const next = { ...r, seats }
  if (!all) return next
  if (isBlackjack(r.dealer)) return settle({ ...next, phase: 'dealer' })
  return advance({ ...next, phase: 'playing' })
}

function advance(r: BjRound): BjRound {
  let turn = r.turn
  while (turn < r.seats.length) {
    const s = r.seats[turn]
    const idx = s.hands.findIndex((h) => !h.done)
    if (idx >= 0) { const seats = r.seats.map((x, i) => (i === turn ? { ...x, active: idx } : x)); return { ...r, seats, turn, phase: 'playing' } }
    turn++
  }
  return dealerPlay({ ...r, turn })
}

export type BjAction = 'hit' | 'stand' | 'double' | 'split'
export function canDo(r: BjRound, seatId: string, a: BjAction): boolean {
  const s = r.seats[r.turn]
  if (r.phase !== 'playing' || !s || s.id !== seatId) return false
  const h = s.hands[s.active]
  if (!h || h.done) return false
  if (a === 'double') return h.cards.length === 2
  if (a === 'split') return h.cards.length === 2 && s.hands.length < 2 && value10(h.cards[0]) === value10(h.cards[1])
  return true
}
const value10 = (c: Card) => (['J', 'Q', 'K', '10'].includes(c.r) ? '10' : c.r)

export function act(r: BjRound, seatId: string, a: BjAction, rng: Rng = Math.random): BjRound {
  if (!canDo(r, seatId, a)) return r
  let d = [...r.deck]
  const draw = () => { if (!d.length) d = shoe(6, rng); return d.pop()! }
  const seats = r.seats.map((s) => ({ ...s, hands: s.hands.map((h) => ({ ...h, cards: [...h.cards] })) }))
  const s = seats[r.turn]
  const h = s.hands[s.active]
  if (a === 'hit') { h.cards.push(draw()); if (handValue(h.cards).total >= 21) h.done = true }
  if (a === 'stand') h.done = true
  if (a === 'double') { h.bet *= 2; h.doubled = true; h.cards.push(draw()); h.done = true }
  if (a === 'split') {
    const second: BjHand = { cards: [h.cards.pop()!, draw()], bet: h.bet, done: false, fromSplit: true }
    h.cards.push(draw()); h.fromSplit = true
    s.hands.push(second)
    if (h.cards[0].r === 'A') { h.done = true; second.done = true } // split aces get one card
  }
  return advance({ ...r, deck: d, seats })
}

function dealerPlay(r: BjRound): BjRound {
  let d = [...r.deck]
  const dealer = [...r.dealer]
  const live = r.seats.some((s) => s.hands.some((h) => handValue(h.cards).total <= 21 && !(isBlackjack(h.cards) && !h.fromSplit)))
  if (live) while (handValue(dealer).total < 17) dealer.push(d.pop() ?? shoe(6)[0])
  return settle({ ...r, deck: d, dealer, phase: 'dealer' })
}

/** Stand on all 17s. Blackjack pays 3:2. Insurance pays 2:1. Payout = net silver change per hand. */
export function settle(r: BjRound): BjRound {
  const dv = handValue(r.dealer).total
  const dbj = isBlackjack(r.dealer)
  const seats = r.seats.map((s) => ({
    ...s,
    hands: s.hands.map((h) => {
      const v = handValue(h.cards).total
      const bj = isBlackjack(h.cards) && !h.fromSplit
      let result: BjHand['result']
      if (v > 21) result = 'lose'
      else if (bj && !dbj) result = 'blackjack'
      else if (dbj && !bj) result = 'lose'
      else if (dv > 21 || v > dv) result = 'win'
      else if (v === dv) result = 'push'
      else result = 'lose'
      const payout = result === 'blackjack' ? Math.floor(h.bet * 1.5) : result === 'win' ? h.bet : result === 'push' ? 0 : -h.bet
      return { ...h, done: true, result, payout }
    }),
  }))
  const withIns = seats.map((s) => ({ ...s, insuranceNet: s.insurance ? (dbj ? s.insurance * 2 : -s.insurance) : 0 }))
  return { ...r, seats: withIns, phase: 'done', hideHole: false }
}
export const seatNet = (s: BjSeat & { insuranceNet?: number }) => s.hands.reduce((n, h) => n + (h.payout ?? 0), 0) + (s.insuranceNet ?? 0)

// ---------- roulette (single zero) ----------
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
export type RouletteBet = { kind: 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' } | { kind: 'dozen'; n: 1 | 2 | 3 } | { kind: 'number'; n: number }
export const spin = (rng: Rng = Math.random) => Math.floor(rng() * 37)
export function rouletteWins(bet: RouletteBet, n: number): number {
  // returns multiplier of profit (0 = lose)
  if (bet.kind === 'number') return bet.n === n ? 35 : 0
  if (n === 0) return 0
  switch (bet.kind) {
    case 'red': return RED_NUMBERS.has(n) ? 1 : 0
    case 'black': return RED_NUMBERS.has(n) ? 0 : 1
    case 'odd': return n % 2 ? 1 : 0
    case 'even': return n % 2 ? 0 : 1
    case 'low': return n <= 18 ? 1 : 0
    case 'high': return n >= 19 ? 1 : 0
    case 'dozen': return Math.ceil(n / 12) === bet.n ? 2 : 0
  }
}
export const betLabel = (b: RouletteBet) => (b.kind === 'number' ? `#${b.n}` : b.kind === 'dozen' ? `Dozen ${b.n}` : b.kind[0].toUpperCase() + b.kind.slice(1))
