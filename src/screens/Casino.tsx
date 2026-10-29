import { useEffect, useState } from 'react'
import { del, getState, list, patch, put, setDoc, useApp } from '../core/store'
import { usePlayerLabel, useRole } from '../core/role'
import type { Character } from '../core/types'
import { uid } from '../core/types'
import { coinLabel, fromSilver, pay, receive, toSilver } from '../rules/character'
import {
  RED_NUMBERS, act, betLabel, canDo, deal, handValue, insure, isRed, rouletteWins, seatNet, spin, type BjAction, type BjRound, type Card, type RouletteBet,
} from '../rules/casino'
import { Empty, Seg, Stepper, toast } from '../ui/kit'
import { burst, calm } from '../ui/fx'
import { addRecap } from './Loot'

/** Net silver to a purse. Losses can't take a purse below zero. */
function settleCoins(charId: string, net: number) {
  if (!net) return
  patch('chars', charId, (c) => (net > 0 ? receive(c, net) : pay(c, Math.min(-net, toSilver(c.purse))) ?? c))
}

export default function Casino() {
  const s = useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const table = s.docs.casino
  const chars = list('chars').filter((c) => role.isDM || role.mine(c))
  const [who, setWho] = useState(chars[0]?.id ?? '')
  const [game, setGame] = useState<'blackjack' | 'roulette'>('blackjack')
  const c = s.cols.chars[who] ?? chars[0]
  return (
    <div className="stack">
      <div className="row between"><h2>🎰 Casino</h2>{role.isDM && !role.readOnly && (table.open
        ? <button className="btn small ghost" onClick={() => { setDoc('casino', (t) => ({ ...t, open: false, round: null })); list('seats').forEach((x) => del('seats', x.id)) }}>Close table</button>
        : <button className="btn small primary" onClick={() => setDoc('casino', (t) => ({ ...t, open: true, round: null }))}>🃏 Open casino table</button>)}</div>
      {chars.length ? <div className="row"><span className="label">Who's playing?</span>{chars.map((x) => <button key={x.id} className={`chip ${x.id === c?.id ? 'on' : ''}`} onClick={() => setWho(x.id)}>{label(x)} · {coinLabel(x.purse)}</button>)}</div> : <Empty>Make a character first — they bet from their purse.</Empty>}
      {table.open && <DealerTable c={c} />}
      {!table.open && c && (
        <>
          <Seg value={game} onChange={setGame} options={[{ id: 'blackjack', label: '🂡 Blackjack' }, { id: 'roulette', label: '🎡 Roulette' }]} />
          {game === 'blackjack' ? <SoloBlackjack c={c} canPlay={role.canEdit(c)} /> : <Roulette c={c} canPlay={role.canEdit(c)} />}
        </>
      )}
    </div>
  )
}

const CardView = ({ card, hidden }: { card: Card; hidden?: boolean }) =>
  hidden ? <div className="pcard back" aria-label="face-down card" /> : <div className={`pcard ${isRed(card) ? 'red' : ''}`}><span>{card.r}</span><span className="s">{card.s}</span></div>

function Hand({ cards, hide, title }: { cards: Card[]; hide?: boolean; title: string }) {
  const v = handValue(hide ? cards.slice(0, 1) : cards)
  return <div className="stack" style={{ gap: 4 }}><div className="row between"><b>{title}</b><span className="num">{hide ? `${v.total} + ?` : v.total}{!hide && v.soft && v.total < 21 ? ' soft' : ''}</span></div><div className="cards">{cards.map((cd, i) => <CardView key={i} card={cd} hidden={hide && i === 1} />)}</div></div>
}

function BetPicker({ bet, setBet, max }: { bet: number; setBet: (n: number) => void; max: number }) {
  return (
    <div className="row">
      <span className="label">Bet</span><b className="num">{coinLabel(fromSilver(bet))}</b>
      <button className="btn small" onClick={() => setBet(Math.max(0, bet - 10))}>−1g</button><button className="btn small" onClick={() => setBet(Math.min(max, bet + 10))}>+1g</button>
      <button className="btn small" onClick={() => setBet(Math.max(0, bet - 1))}>−1s</button><button className="btn small" onClick={() => setBet(Math.min(max, bet + 1))}>+1s</button>
    </div>
  )
}

const RESULT: Record<string, string> = { win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Blackjack! 3:2' }

function SoloBlackjack({ c, canPlay }: { c: Character; canPlay: boolean }) {
  const [bet, setBet] = useState(10)
  const [r, setR] = useState<BjRound | null>(null)
  const [paid, setPaid] = useState(false)
  useEffect(() => {
    if (r?.phase === 'done' && !paid) {
      const net = seatNet(r.seats[0])
      settleCoins(c.id, net)
      if (net > 0) setTimeout(() => burst(document.querySelector('.felt'), { count: r.seats[0].hands.some((h) => h.result === 'blackjack') ? 50 : 24, star: true }), 300)
      if (net) addRecap('🃏', `${c.name} ${net > 0 ? 'won' : 'lost'} ${coinLabel(fromSilver(Math.abs(net)))} at blackjack`)
      setPaid(true)
    }
  }, [r, paid, c.id, c.name])
  const purse = toSilver(c.purse)
  const seat = r?.seats[0]
  const doAct = (a: BjAction) => r && setR(act(r, c.id, a))
  return (
    <div className="felt stack">
      {!r || r.phase === 'done' ? (
        <>
          {r && seat && <div className="stack"><Hand cards={r.dealer} title="Dealer" />{seat.hands.map((h, i) => <Hand key={i} cards={h.cards} title={`${c.name}: ${RESULT[h.result!]}`} />)}<b className="num">Net {seatNet(seat) >= 0 ? '+' : '−'}{coinLabel(fromSilver(Math.abs(seatNet(seat))))}</b></div>}
          <BetPicker bet={bet} setBet={setBet} max={purse} />
          <button className="btn primary" disabled={!canPlay || bet <= 0 || bet > purse} onClick={() => { setPaid(false); setR(deal([{ id: c.id, name: c.name, bet }], r?.deck ?? [])) }}>Deal</button>
          {bet > purse && <small>Not enough coin for that bet.</small>}
        </>
      ) : (
        <>
          <Hand cards={r.dealer} hide={r.hideHole} title="Dealer" />
          {seat!.hands.map((h, i) => <Hand key={i} cards={h.cards} title={`${c.name}${seat!.hands.length > 1 ? ` hand ${i + 1}` : ''} · ${coinLabel(fromSilver(h.bet))}`} />)}
          {r.phase === 'insurance' && <div className="row"><span>Dealer shows an Ace. Insurance?</span><button className="btn small" onClick={() => setR(insure(r, c.id, true))}>Take insurance</button><button className="btn small" onClick={() => setR(insure(r, c.id, false))}>No thanks</button></div>}
          {r.phase === 'playing' && <div className="row">{(['hit', 'stand', 'double', 'split'] as BjAction[]).map((a) => <button key={a} className="btn" disabled={!canDo(r, c.id, a) || ((a === 'double' || a === 'split') && purse < seat!.hands[seat!.active].bet * 2)} onClick={() => doAct(a)}>{a[0].toUpperCase() + a.slice(1)}</button>)}</div>}
        </>
      )}
      <small>Dealer stands on 17. Blackjack pays 3:2, insurance 2:1.</small>
    </div>
  )
}

function Roulette({ c, canPlay }: { c: Character; canPlay: boolean }) {
  const [bet, setBet] = useState(10)
  const [pick, setPick] = useState<RouletteBet>({ kind: 'red' })
  const [num, setNum] = useState(17)
  const [last, setLast] = useState<{ n: number; won: number } | null>(null)
  const [spinning, setSpinning] = useState(false)
  const purse = toSilver(c.purse)
  const go = () => {
    const n = spin()
    const mult = rouletteWins(pick, n)
    const net = mult ? bet * mult : -bet
    setSpinning(true); setLast(null)
    setTimeout(() => {
      setSpinning(false); setLast({ n, won: net }); settleCoins(c.id, net)
      if (net > 0) burst(document.querySelector('.wheel-num'), { count: mult >= 35 ? 60 : 24, star: true })
    }, calm() ? 0 : 1600)
    addRecap('🎡', `${c.name} bet ${betLabel(pick)} — ${n}: ${net > 0 ? 'won' : 'lost'} ${coinLabel(fromSilver(Math.abs(net)))}`)
  }
  const kinds: RouletteBet[] = [{ kind: 'red' }, { kind: 'black' }, { kind: 'odd' }, { kind: 'even' }, { kind: 'low' }, { kind: 'high' }, { kind: 'dozen', n: 1 }, { kind: 'dozen', n: 2 }, { kind: 'dozen', n: 3 }]
  return (
    <div className="felt stack">
      {(spinning || !last) && <div className="wheel-wrap"><div className={`wheel ${spinning ? 'spinning' : ''}`} /></div>}
      {last && <><div className="wheel-num" style={{ background: last.n === 0 ? '#1f7a3f' : RED_NUMBERS.has(last.n) ? '#b3202a' : '#1d1d1d' }}>{last.n}</div><p style={{ textAlign: 'center' }}><b>{last.won > 0 ? `Won ${coinLabel(fromSilver(last.won))}!` : `Lost ${coinLabel(fromSilver(-last.won))}`}</b></p></>}
      <div className="row">{kinds.map((k) => <button key={betLabel(k)} className={`chip ${betLabel(k) === betLabel(pick) ? 'on' : ''}`} onClick={() => setPick(k)}>{betLabel(k)}</button>)}
        <button className={`chip ${pick.kind === 'number' ? 'on' : ''}`} onClick={() => setPick({ kind: 'number', n: num })}>Number</button>
        {pick.kind === 'number' && <Stepper value={num} min={0} max={36} onChange={(n) => { setNum(n); setPick({ kind: 'number', n }) }} />}</div>
      <BetPicker bet={bet} setBet={setBet} max={purse} />
      <button className="btn primary" disabled={!canPlay || spinning || bet <= 0 || bet > purse} onClick={go}>{spinning ? 'Spinning…' : 'Spin'}</button>
      <small>Single zero. Red/black/odd/even/low/high pay 1:1, dozens 2:1, a single number 35:1.</small>
    </div>
  )
}

/** The shared table: the DM is the dealer; players sit, bet and act from their own phones. */
function DealerTable({ c }: { c?: Character }) {
  const s = useApp()
  const role = useRole()
  const t = s.docs.casino
  const r = t.round
  const seats = list('seats')
  const mine = seats.find((x) => x.id === c?.id)
  const dm = role.isDM && !role.readOnly
  const purse = c ? toSilver(c.purse) : 0
  const sendAction = (kind: BjAction | 'insure' | 'noinsure') => mine && put('seats', { ...mine, action: { id: uid(), kind } })
  return (
    <div className="felt stack">
      <div className="row between"><b>🃏 Casino table — the DM deals</b><small>Hand #{t.handNo}</small></div>
      {r ? (
        <>
          <Hand cards={r.dealer} hide={r.hideHole} title="Dealer" />
          {r.seats.map((st, i) => (
            <div key={st.id} style={{ outline: r.phase === 'playing' && r.turn === i ? '2px solid #f2c14e' : 'none', borderRadius: 10, padding: 4 }}>
              {st.hands.map((h, j) => <Hand key={j} cards={h.cards} title={`${st.name}${st.hands.length > 1 ? ` (${j + 1})` : ''} · ${coinLabel(fromSilver(h.bet))}${h.result ? ` · ${RESULT[h.result]}` : ''}`} />)}
              {r.phase === 'done' && <b className="num">Net {seatNet(st) >= 0 ? '+' : '−'}{coinLabel(fromSilver(Math.abs(seatNet(st))))}</b>}
            </div>
          ))}
          {mine && r.phase === 'insurance' && r.seats.some((x) => x.id === mine.id && x.insurance === undefined) && <div className="row"><span>Insurance?</span><button className="btn small" onClick={() => sendAction('insure')}>Yes</button><button className="btn small" onClick={() => sendAction('noinsure')}>No</button></div>}
          {mine && r.phase === 'playing' && r.seats[r.turn]?.id === mine.id && <div className="row">{(['hit', 'stand', 'double', 'split'] as BjAction[]).map((a) => <button key={a} className="btn" disabled={!canDo(r, mine.id, a)} onClick={() => sendAction(a)}>{a[0].toUpperCase() + a.slice(1)}</button>)}</div>}
          {dm && r.phase === 'insurance' && <button className="btn small" onClick={() => setDoc('casino', (x) => ({ ...x, round: x.round && x.round.seats.reduce((rr, st) => (st.insurance === undefined ? insure(rr, st.id, false) : rr), x.round) }))}>Skip insurance for anyone who hasn't answered</button>}
          {dm && r.phase === 'done' && <button className="btn primary" onClick={() => setDoc('casino', (x) => ({ ...x, round: null }))}>Next hand</button>}
        </>
      ) : (
        <>
          {seats.length ? seats.map((st) => <div key={st.id} className="row between"><span>{st.name}</span><b className="num">{coinLabel(fromSilver(st.bet))}</b></div>) : <p>No one has sat down yet.</p>}
          {c && !mine && role.canEdit(c) && <button className="btn" onClick={() => put('seats', { id: c.id, name: c.name, bet: Math.min(10, purse) })}>Sit down at the casino table</button>}
          {c && mine && <><BetPicker bet={mine.bet} setBet={(n) => put('seats', { ...mine, bet: n })} max={purse} /><button className="btn small ghost" onClick={() => del('seats', mine.id)}>Stand up</button></>}
          {dm && <button className="btn primary" disabled={!seats.some((x) => x.bet > 0)} onClick={() => setDoc('casino', (x) => ({ ...x, handNo: x.handNo + 1, round: deal(list('seats').map((st) => ({ id: st.id, name: st.name, bet: Math.min(st.bet, toSilver(getState().cols.chars[st.id]?.purse)) })), x.deck), paidHand: undefined }))}>Deal</button>}
        </>
      )}
    </div>
  )
}

/** Runs on the DM's device on every tab: applies players' table actions and pays out finished hands. */
export function CasinoDealer() {
  const s = useApp()
  const t = s.docs.casino
  const seats = s.cols.seats
  useEffect(() => {
    if (!t.open || !t.round) return
    let r = t.round
    let changed = false
    for (const st of Object.values(seats)) {
      if (!st.action || st.action.id === st.handled) continue
      const k = st.action.kind
      r = k === 'insure' || k === 'noinsure' ? (r.phase === 'insurance' ? insure(r, st.id, k === 'insure') : r) : act(r, st.id, k)
      put('seats', { ...st, handled: st.action.id })
      changed = true
    }
    if (changed) setDoc('casino', (x) => ({ ...x, round: r, deck: r.deck }))
    if (r.phase === 'done' && t.paidHand !== t.handNo) {
      for (const st of r.seats) { const net = seatNet(st); settleCoins(st.id, net); if (net) addRecap('🃏', `${st.name} ${net > 0 ? 'won' : 'lost'} ${coinLabel(fromSilver(Math.abs(net)))} at the casino table`) }
      setDoc('casino', (x) => ({ ...x, paidHand: x.handNo }))
      toast('Hand settled — winnings paid')
    }
  }, [t, seats])
  return null
}
