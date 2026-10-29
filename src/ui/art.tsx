// Item art, drawn in code: one small SVG per item family, tinted by rarity.
// Legendary and Mythic get gold trim and sparkles. No image files, no generated portraits.
import type { Item } from '../core/types'
import { MAT_COLOR } from '../rules/gear'
import { rarityOf } from '../rules/tiers'

const METAL = 'url(#lk-metal)'
const GOLD = '#f2c14e'

function shape(it: Item, accent: string): JSX.Element {
  const w = it.weaponId ?? ''
  const n = it.name.toLowerCase()
  if (it.kind === 'weapon') {
    if (/bow/.test(w) || /\bbow\b|crossbow/.test(n)) {
      const big = w === 'longbow'
      return <g><path d={big ? 'M14 4 Q40 24 14 44' : 'M16 8 Q38 24 16 40'} fill="none" stroke="#8a5a2b" strokeWidth="4" strokeLinecap="round" /><line x1={big ? 14 : 16} y1={big ? 4 : 8} x2={big ? 14 : 16} y2={big ? 44 : 40} stroke="#e8e2d0" strokeWidth="1.2" /><line x1="8" y1="24" x2="40" y2="24" stroke="#c9b48a" strokeWidth="2" /><path d="M40 24 l-5 -3 v6z" fill={METAL} /><path d="M10 21 l-3 3 3 3" fill="none" stroke={accent} strokeWidth="2" /></g>
    }
    if (/axe/.test(w) || /axe/.test(n)) {
      const big = w === 'greataxe'
      return <g><line x1="14" y1="42" x2="32" y2="8" stroke="#8a5a2b" strokeWidth="4" strokeLinecap="round" /><path d={big ? 'M28 6 Q46 8 42 26 Q34 18 24 20z' : 'M28 8 Q42 10 38 22 Q32 17 25 18z'} fill={METAL} stroke="#4a515b" strokeWidth="1" />{big && <path d="M26 10 Q14 4 12 16 Q20 14 24 18z" fill={METAL} stroke="#4a515b" strokeWidth="1" />}<circle cx="15" cy="40" r="2" fill={accent} /></g>
    }
    if (/mace|hammer|club|maul/.test(w + n)) {
      const hammer = /hammer|maul/.test(w + n)
      return <g><line x1="12" y1="42" x2="30" y2="14" stroke="#8a5a2b" strokeWidth="4" strokeLinecap="round" />{hammer ? <rect x="22" y="4" width="20" height="12" rx="2" transform="rotate(33 32 10)" fill={METAL} stroke="#4a515b" /> : <g><circle cx="32" cy="12" r="8" fill={METAL} stroke="#4a515b" />{[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M32 2 l2 4 h-4z" fill="#9aa3ad" transform={`rotate(${a} 32 12)`} />)}</g>}<circle cx="13" cy="40" r="2" fill={accent} /></g>
    }
    // blades
    const len = w === 'dagger' ? 18 : w === 'shortsword' ? 24 : w === 'greatsword' ? 34 : w === 'rapier' ? 30 : 28
    const wid = w === 'rapier' ? 2.2 : w === 'greatsword' ? 6 : 4.5
    return (
      <g transform="rotate(45 24 24)">
        <path d={`M24 ${40 - len} L${24 + wid / 2} ${36 - len + 4} L${24 + wid / 2} 34 L${24 - wid / 2} 34 L${24 - wid / 2} ${36 - len + 4}z`} fill={METAL} stroke="#4a515b" strokeWidth="0.8" />
        <line x1="24" y1={40 - len + 3} x2="24" y2="33" stroke="#ffffff" strokeOpacity=".5" strokeWidth=".8" />
        {w === 'rapier' ? <path d="M18 35 Q24 40 30 35" fill="none" stroke={GOLD} strokeWidth="2" /> : <rect x={w === 'greatsword' ? 15 : 17} y="34" width={w === 'greatsword' ? 18 : 14} height="3" rx="1.5" fill="#6b4a2a" />}
        <rect x="22.5" y="37" width="3" height={w === 'greatsword' ? 9 : 7} fill="#5a3a1e" />
        <circle cx="24" cy={w === 'greatsword' ? 47 : 45} r="2.2" fill={accent} />
      </g>
    )
  }
  if (it.kind === 'armor') {
    const id = it.armorId ?? ''
    const fill = /padded/.test(id) ? '#c9b48a' : /leather|studded|hide/.test(id) ? (id === 'hide' ? '#8b6a46' : '#9a6b3f') : METAL
    const body = id === 'plate' || id === 'breastplate' || id === 'half-plate'
      ? 'M12 10 Q24 6 36 10 L38 20 Q36 34 34 42 L14 42 Q12 34 10 20z'
      : 'M14 8 L20 6 Q24 10 28 6 L34 8 L38 18 L34 20 L34 42 L14 42 L14 20 L10 18z'
    return (
      <g>
        <path d={body} fill={fill} stroke="#3a3128" strokeWidth="1.2" />
        {id === 'studded' && [16, 22, 28, 34].flatMap((y) => [18, 24, 30].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="#d9d2c0" />))}
        {id === 'padded' && [16, 22, 28, 34].map((y) => <line key={y} x1="15" y1={y} x2="33" y2={y} stroke="#9c8660" strokeWidth="1" />)}
        {id === 'hide' && <path d="M14 20 l3 3 3 -3 3 3 3 -3 3 3 3 -3 3 3" fill="none" stroke="#5e4630" strokeWidth="1.5" />}
        {/chain|ring/.test(id) && <path d="M15 16 h18 M15 21 h18 M15 26 h18 M15 31 h18 M15 36 h18" stroke="#5b636e" strokeWidth="1.5" strokeDasharray="2 1.5" />}
        {/scale|splint/.test(id) && [16, 21, 26, 31, 36].map((y) => <path key={y} d={`M15 ${y} q2.25 3 4.5 0 q2.25 3 4.5 0 q2.25 3 4.5 0 q2.25 3 4.5 0`} fill="none" stroke="#5b636e" strokeWidth="1.2" />)}
        {(id === 'plate' || id === 'half-plate' || id === 'breastplate') && <path d="M24 9 V40 M14 24 Q24 28 34 24" stroke="#5b636e" strokeWidth="1.3" fill="none" />}
        <path d="M20 6 Q24 10 28 6" fill="none" stroke={accent} strokeWidth="2" />
      </g>
    )
  }
  if (it.kind === 'shield') {
    const id = it.shieldId
    if (id === 'small') return <g><circle cx="24" cy="24" r="15" fill="#8a5a2b" stroke="#4a3018" strokeWidth="2" /><circle cx="24" cy="24" r="15" fill="none" stroke={METAL} strokeWidth="3" /><circle cx="24" cy="24" r="4.5" fill={METAL} stroke="#4a515b" /><circle cx="24" cy="24" r="1.5" fill={accent} /></g>
    if (id === 'heavy') return <g><rect x="11" y="5" width="26" height="38" rx="4" fill="#7a4f27" stroke="#3a2412" strokeWidth="2" /><rect x="11" y="5" width="26" height="38" rx="4" fill="none" stroke={METAL} strokeWidth="2.5" /><path d="M24 9 V39 M15 22 H33" stroke={accent} strokeWidth="2.5" /></g>
    return <g><path d="M10 8 H38 V22 Q38 36 24 44 Q10 36 10 22z" fill="#2f4d7a" stroke={METAL} strokeWidth="3" /><path d="M24 12 V38 M14 21 H34" stroke={accent} strokeWidth="2.5" /></g>
  }
  if (it.kind === 'accessory') {
    if (it.slot === 'head') return <g><path d="M10 30 Q10 10 24 10 Q38 10 38 30z" fill={METAL} stroke="#4a515b" strokeWidth="1.3" /><rect x="8" y="29" width="32" height="5" rx="2" fill="#7d8794" /><path d="M24 10 V29" stroke={accent} strokeWidth="2" /></g>
    if (it.slot === 'hands') return <g><path d="M16 42 V22 Q16 18 19 18 V10 Q21 8 23 10 V18 V8 Q25 6 27 8 V18 V10 Q29 8 31 10 V20 Q34 18 35 21 L32 32 V42z" fill="#9a6b3f" stroke="#4a3018" strokeWidth="1.3" /><rect x="15" y="36" width="18" height="6" fill={accent} /></g>
    return <g><path d="M14 8 H24 V30 Q34 30 38 36 V42 H12 V30z" fill="#7a5638" stroke="#3a2412" strokeWidth="1.3" /><path d="M12 38 H38" stroke={accent} strokeWidth="2.5" /></g>
  }
  if (it.kind === 'consumable' || it.kind === 'scroll') {
    if (it.kind === 'scroll') return <g><rect x="12" y="12" width="24" height="26" fill="#efe2bf" stroke="#9c8660" /><rect x="9" y="8" width="30" height="6" rx="3" fill="#d8c79a" stroke="#9c8660" /><rect x="9" y="36" width="30" height="6" rx="3" fill="#d8c79a" stroke="#9c8660" /><path d="M16 19 h16 M16 24 h12 M16 29 h14" stroke="#7a6a4a" strokeWidth="1.2" /><circle cx="33" cy="33" r="3" fill={accent} /></g>
    if (it.consKey === 'field-repair') return kit(accent)
    const liquid = it.consKey?.startsWith('heal') ? '#d8344a' : /oil|whet/.test(it.consKey ?? '') ? '#d9b84a' : accent
    return <g><path d="M20 6 h8 v10 q10 5 10 15 q0 12 -14 12 q-14 0 -14 -12 q0 -10 10 -15z" fill="#dfe8f0" fillOpacity=".35" stroke="#c8d3dd" strokeWidth="1.5" /><path d="M11.5 30 q0 -2 1 -4 h23 q1 2 1 4 q0 11 -12.5 11 q-12.5 0 -12.5 -11z" fill={liquid} /><rect x="19" y="3" width="10" height="5" rx="1.5" fill="#8a5a2b" /><circle cx="19" cy="31" r="2" fill="#fff" fillOpacity=".7" /></g>
  }
  if (it.kind === 'material') {
    const c = MAT_COLOR[it.mat ?? 'gray']
    return <g><path d="M24 6 L38 18 L32 40 L16 40 L10 18z" fill={c} stroke="#20232a" strokeWidth="1.3" /><path d="M24 6 L24 40 M10 18 L38 18 M16 40 L24 18 L32 40" stroke="#fff" strokeOpacity=".35" fill="none" /></g>
  }
  if (it.kind === 'kit') return kit(accent)
  // misc
  if (/lantern/.test(n)) return <g><rect x="16" y="14" width="16" height="22" rx="3" fill="#f6d27a" fillOpacity=".8" stroke="#6b4a2a" strokeWidth="2" /><path d="M18 14 Q24 4 30 14" fill="none" stroke="#6b4a2a" strokeWidth="2" /><rect x="14" y="36" width="20" height="5" fill="#6b4a2a" /><circle cx="24" cy="25" r="4" fill={accent} /></g>
  if (/coin/.test(n)) return <g><circle cx="24" cy="24" r="14" fill={accent} stroke="#7a2a55" strokeWidth="2" /><circle cx="24" cy="24" r="9" fill="none" stroke="#fff" strokeOpacity=".5" /></g>
  if (/pouch|purse/.test(n)) return <g><path d="M14 18 Q10 40 24 42 Q38 40 34 18z" fill="#8a5a2b" stroke="#4a3018" strokeWidth="1.3" /><path d="M16 18 Q24 12 32 18" stroke={GOLD} strokeWidth="2.5" fill="none" /></g>
  return <g><path d="M12 16 h24 l-3 26 h-18z" fill="#8a6a46" stroke="#3a2412" strokeWidth="1.3" /><path d="M16 16 Q24 6 32 16" fill="none" stroke="#3a2412" strokeWidth="2" /><circle cx="24" cy="28" r="3" fill={accent} /></g>
}
const kit = (accent: string) => <g><rect x="8" y="18" width="32" height="22" rx="3" fill="#7a4f27" stroke="#3a2412" strokeWidth="1.5" /><path d="M18 18 v-5 h12 v5" fill="none" stroke="#3a2412" strokeWidth="2.5" /><rect x="8" y="25" width="32" height="4" fill={accent} /><path d="M30 9 l6 6 -3 3 -6 -6z" fill={METAL} /></g>

export function ItemArt({ it, size = 40 }: { it: Item; size?: number }) {
  const r = rarityOf(it)
  const accent = it.kind === 'material' ? MAT_COLOR[it.mat ?? 'gray'] : r?.color ?? '#b7a77e'
  const up = it.tier === 'legendary' || it.tier === 'mythic' || it.special === 'black'
  return (
    <svg className="art" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ borderColor: accent }}>
      <defs>
        <linearGradient id="lk-metal" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#eef2f6" /><stop offset=".5" stopColor="#aab3be" /><stop offset="1" stopColor="#6d7783" /></linearGradient>
        <radialGradient id={`g-${accent.slice(1)}`}><stop offset="0" stopColor={accent} stopOpacity=".45" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
      </defs>
      {(up || it.tier === 'purple') && <circle cx="24" cy="24" r="23" fill={`url(#g-${accent.slice(1)})`} />}
      {shape(it, up ? GOLD : accent)}
      {up && <g fill="#fff6c8">{[[8, 9, 2], [40, 12, 1.6], [38, 40, 2.2], [9, 38, 1.4]].map(([x, y, s], i) => <path key={i} d={`M${x} ${y - s * 2} L${x + s / 2} ${y - s / 2} L${x + s * 2} ${y} L${x + s / 2} ${y + s / 2} L${x} ${y + s * 2} L${x - s / 2} ${y + s / 2} L${x - s * 2} ${y} L${x - s / 2} ${y - s / 2}z`} />)}</g>}
    </svg>
  )
}
