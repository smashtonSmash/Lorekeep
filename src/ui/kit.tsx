// Small shared UI pieces. Dialogs are built in (browser confirm/alert are blocked inside artifacts).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { rarityOf } from '../rules/tiers'
import type { Item, Special, Tier } from '../core/types'

// ---------- bottom sheet ----------
let lockCount = 0
function useScrollLock(on: boolean) {
  useEffect(() => {
    if (!on) return
    lockCount++
    document.body.classList.add('locked')
    return () => { lockCount = Math.max(0, lockCount - 1); if (!lockCount) document.body.classList.remove('locked') }
  }, [on])
}
export function Sheet({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useScrollLock(true)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

// ---------- toasts & confirm ----------
type ToastT = { id: number; text: string; tone?: 'good' | 'bad' }
let toastSet: ((f: (t: ToastT[]) => ToastT[]) => void) | null = null
let tid = 0
export function toast(text: string, tone?: 'good' | 'bad') {
  const id = ++tid
  toastSet?.((t) => [...t.slice(-2), { id, text, tone }])
  setTimeout(() => toastSet?.((t) => t.filter((x) => x.id !== id)), 3200)
  try { navigator.vibrate?.(12) } catch { /* not allowed */ }
}
type Ask = { text: string; ok: string; danger?: boolean; resolve: (v: boolean) => void }
let askSet: ((a: Ask | null) => void) | null = null
export const confirmBox = (text: string, ok = 'OK', danger = false) => new Promise<boolean>((resolve) => askSet ? askSet({ text, ok, danger, resolve }) : resolve(true))

export function Overlays() {
  const [toasts, setToasts] = useState<ToastT[]>([])
  const [ask, setAsk] = useState<Ask | null>(null)
  useEffect(() => { toastSet = setToasts; askSet = setAsk; return () => { toastSet = null; askSet = null } }, [])
  const done = (v: boolean) => { ask?.resolve(v); setAsk(null) }
  return (
    <>
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.tone ?? ''}`}>{t.text}</div>)}</div>
      {ask && (
        <div className="scrim center" onPointerDown={(e) => e.target === e.currentTarget && done(false)}>
          <div className="confirm">
            <p>{ask.text}</p>
            <div className="row end"><button className="btn ghost" onClick={() => done(false)}>Cancel</button><button className={`btn ${ask.danger ? 'danger' : 'primary'}`} onClick={() => done(true)}>{ask.ok}</button></div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- bits ----------
export function RarityTag({ it }: { it: { tier?: Tier; special?: Special } }) {
  const r = rarityOf(it)
  return r ? <span className="tag" style={{ color: r.color, borderColor: r.color }}>{r.label}</span> : null
}
export function HpBar({ hp, max, temp = 0 }: { hp: number; max: number; temp?: number }) {
  const pct = max ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0
  const tone = hp <= 0 ? 'down' : pct <= 25 ? 'low' : pct <= 50 ? 'mid' : 'ok'
  // a pale ghost of the lost HP lingers, then drains away
  const [trail, setTrail] = useState(pct)
  const prev = useRef(pct)
  useEffect(() => {
    if (pct < prev.current) { setTrail(prev.current); const t = setTimeout(() => setTrail(pct), 30); prev.current = pct; return () => clearTimeout(t) }
    prev.current = pct; setTrail(pct)
  }, [pct])
  return (
    <div className="hpbar" aria-label={`${hp} of ${max} HP`}>
      <div className="trail" style={{ width: `${Math.max(trail, pct)}%` }} />
      <div className={`fill ${tone}`} style={{ width: `${pct}%` }} />
      <span>{hp}/{max}{temp ? ` +${temp}` : ''}</span>
    </div>
  )
}
export function DurBar({ cur, max }: { cur: number; max: number }) {
  const pct = max ? (cur / max) * 100 : 0
  return <div className="durbar" title={`${cur}/${max}`}><div style={{ width: `${pct}%` }} className={cur <= 0 ? 'broken' : pct <= 50 ? 'damaged' : ''} /><span>{cur}/{max}</span></div>
}
export function Stepper({ value, onChange, min = -Infinity, max = Infinity, step = 1, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label?: string }) {
  return (
    <div className="stepper" aria-label={label}>
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="less">−</button>
      <input inputMode="numeric" value={Number.isFinite(value) ? value : ''} onChange={(e) => { const n = parseInt(e.target.value.replace(/[^0-9-]/g, ''), 10); onChange(Number.isNaN(n) ? 0 : Math.max(min, Math.min(max, n))) }} />
      <button onClick={() => onChange(Math.min(max, value + step))} aria-label="more">+</button>
    </div>
  )
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map((o) => <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
}
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>
export const itemColor = (it: Item) => rarityOf(it)?.color
