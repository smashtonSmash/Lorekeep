// Little moments of delight: drifting embers, spark bursts, screen flashes. All of it steps aside for reduced motion.
import { useEffect, useRef } from 'react'

export const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

/** Candle embers rising slowly behind everything. */
export function Embers() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || calm()) return
    const g = cv.getContext('2d')
    if (!g) return
    let w = 0, h = 0, raf = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const size = () => { w = innerWidth; h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0) }
    size()
    const color = getComputedStyle(document.documentElement).getPropertyValue('--ember').trim() || '255 160 70'
    const P = Array.from({ length: Math.round(Math.min(34, w / 14)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: .6 + Math.random() * 1.8, v: .15 + Math.random() * .45, s: Math.random() * 6.28, a: .2 + Math.random() * .5 }))
    let last = performance.now()
    const tick = (t: number) => {
      const dt = Math.min(50, t - last) / 16.7
      last = t
      g.clearRect(0, 0, w, h)
      for (const p of P) {
        p.y -= p.v * dt; p.s += .02 * dt; p.x += Math.sin(p.s) * .3 * dt
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w }
        const flick = p.a * (.7 + .3 * Math.sin(t / 300 + p.s * 5))
        const fade = Math.min(1, p.y / (h * .35))
        g.beginPath(); g.fillStyle = `rgb(${color} / ${(flick * fade).toFixed(3)})`
        g.shadowColor = `rgb(${color} / .8)`; g.shadowBlur = 6
        g.arc(p.x, p.y, p.r, 0, 6.28); g.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick) } }
    raf = requestAnimationFrame(tick)
    addEventListener('resize', size); document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return <canvas ref={ref} className="embers" aria-hidden="true" />
}

const GOLD = ['#ffd166', '#f2c14e', '#fff3c4', '#f08a2a']
/** A spray of sparks from a point (or from an element's center). */
export function burst(at: { x: number; y: number } | Element | null, o: { count?: number; colors?: string[]; star?: boolean; spread?: number } = {}) {
  if (calm()) return
  let x = innerWidth / 2, y = innerHeight / 2.4
  if (at instanceof Element) { const r = at.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2 } else if (at) { x = at.x; y = at.y }
  const n = o.count ?? 22, colors = o.colors ?? GOLD, spread = o.spread ?? 130
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span')
    el.className = `spark${o.star || i % 3 === 0 ? ' star' : ''}`
    const ang = Math.random() * Math.PI * 2, d = spread * (.4 + Math.random() * .8)
    el.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(ang) * d}px;--dy:${Math.sin(ang) * d + 30}px;--rot:${Math.random() * 540}deg;--dur:${.7 + Math.random() * .6}s`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1400)
  }
}

/** A full-screen flash: crit (gold), down (red vignette), good (green). Crits also shake the page. */
export function flash(kind: 'crit' | 'down' | 'good') {
  if (calm()) return
  const el = document.createElement('div')
  el.className = `flash ${kind}`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 600)
  if (kind !== 'good') { document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); setTimeout(() => document.body.classList.remove('quake'), 450) }
  try { navigator.vibrate?.(kind === 'crit' ? [20, 30, 40] : kind === 'down' ? 80 : 15) } catch { /* no vibration */ }
}

export const celebrate = (at?: Element | null) => { burst(at ?? null, { count: 30 }); flash('good') }
