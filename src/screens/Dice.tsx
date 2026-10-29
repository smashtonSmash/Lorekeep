import { useState } from 'react'
import { parseDice, roll } from '../core/dice'
import { setLocal, useApp } from '../core/store'
import { uid, type DiceRoll } from '../core/types'
import { Empty } from '../ui/kit'

const DICE = [4, 6, 8, 10, 12, 20, 100]

export default function Dice() {
  const s = useApp()
  const [pool, setPool] = useState<Record<number, number>>({})
  const [mod, setMod] = useState(0)
  const [typed, setTyped] = useState('')
  const last = s.local.dice[0]
  const poolExpr = [...DICE.filter((d) => pool[d]).map((d) => `${pool[d]}d${d}`), mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ''].join('+').replace(/\+-/g, '-').replace(/\+\+/g, '+').replace(/\+$/, '')
  const expr = typed.trim() || poolExpr
  const valid = !!expr && !!parseDice(expr)
  const go = () => {
    if (!valid) return
    const r = roll(expr)
    const single20 = /^1?d20([+-]\d+)?$/i.test(expr.replace(/\s/g, ''))
    const nat = single20 ? (r.rolls[0]?.value === 20 ? 'crit' : r.rolls[0]?.value === 1 ? 'fumble' : undefined) : undefined
    const entry: DiceRoll = { id: uid(), expr, parts: r.rolls.map((x) => ({ die: x.sides, value: x.sign * x.value })), mod: r.mod, total: r.total, t: Date.now(), nat }
    setLocal((l) => ({ ...l, dice: [entry, ...l.dice].slice(0, 60) }))
    try { navigator.vibrate?.(nat ? [30, 40, 30] : 15) } catch { /* no vibration */ }
  }
  return (
    <div className="stack">
      <div className="card stack" style={{ alignItems: 'center' }}>
        {last ? (
          <>
            {last.nat === 'crit' && <div className="callout crit">NATURAL 20!</div>}
            {last.nat === 'fumble' && <div className="callout fumble">Natural 1…</div>}
            <div className="big-total" aria-live="polite">{last.total}</div>
            <div className="muted num">{last.expr} → {last.parts.map((p) => p.value).join(' + ')}{last.mod ? ` ${last.mod > 0 ? '+' : '−'} ${Math.abs(last.mod)}` : ''}</div>
          </>
        ) : <div className="muted">Build a pool and roll.</div>}
      </div>
      <div className="dice-grid">
        {DICE.map((d) => <button key={d} className="die" onClick={() => { setTyped(''); setPool((p) => ({ ...p, [d]: (p[d] ?? 0) + 1 })) }}>d{d}{pool[d] ? <span className="count" role="button" aria-label={`remove one d${d}`} onClick={(e) => { e.stopPropagation(); setPool((p) => ({ ...p, [d]: Math.max(0, (p[d] ?? 0) - 1) })) }}>{pool[d]}</span> : null}</button>)}
        <button className="die" onClick={() => setMod(mod + 1)} onContextMenu={(e) => { e.preventDefault(); setMod(mod - 1) }}>{mod >= 0 ? `+${mod}` : mod}</button>
      </div>
      <div className="row"><button className="btn small" onClick={() => setMod(mod - 1)}>− mod</button><button className="btn small" onClick={() => setMod(mod + 1)}>＋ mod</button><button className="btn small ghost" onClick={() => { setPool({}); setMod(0); setTyped('') }}>Clear pool</button><span className="muted" style={{ fontSize: '.85rem' }}>Tap a count bubble to remove one.</span></div>
      <div className="row nowrap">
        <input id="dice-expr" placeholder="or type 2d6+1d4+3" value={typed || poolExpr} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} style={{ flex: 1 }} />
        <button className="btn primary" disabled={!valid} onClick={go} style={{ minWidth: 96 }}>ROLL</button>
      </div>
      <div className="row between"><h3>History</h3>{s.local.dice.length > 0 && <button className="btn small ghost" onClick={() => setLocal((l) => ({ ...l, dice: [] }))}>Clear</button>}</div>
      {s.local.dice.length ? (
        <div className="stack" style={{ gap: 6 }}>{s.local.dice.map((r) => (
          <div key={r.id} className="card tight row between"><span className="num"><b>{r.total}</b> <span className="muted">{r.expr}{r.nat === 'crit' ? ' · nat 20' : r.nat === 'fumble' ? ' · nat 1' : ''}</span></span><small>{new Date(r.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>
        ))}</div>
      ) : <Empty>No rolls yet.</Empty>}
    </div>
  )
}
