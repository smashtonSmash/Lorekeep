// Dice expressions like "2d6+1d4+3" or "d20-1".
export type Rng = () => number

export const rollDie = (sides: number, rng: Rng = Math.random) => 1 + Math.floor(rng() * sides)

export interface DiceTerm { count: number; sides: number; sign: 1 | -1 }
export interface Parsed { dice: DiceTerm[]; mod: number }

export function parseDice(expr: string): Parsed | null {
  const s = expr.replace(/\s+/g, '').toLowerCase()
  if (!s) return null
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gy
  const out: Parsed = { dice: [], mod: 0 }
  let m: RegExpExecArray | null
  let pos = 0
  while (pos < s.length && (m = re.exec(s))) {
    if (m.index !== pos) return null
    pos = re.lastIndex
    if (m[3]) {
      const sides = +m[3]
      const count = m[2] ? +m[2] : 1
      if (!sides || count > 200) return null
      out.dice.push({ count, sides, sign: m[1] === '-' ? -1 : 1 })
    } else out.mod += (m[4] === '-' ? -1 : 1) * +m[5]
  }
  return pos === s.length ? out : null
}

export interface RollResult { total: number; rolls: { sides: number; value: number; sign: 1 | -1 }[]; mod: number }

export function roll(expr: string, rng: Rng = Math.random, opts: { crit?: boolean } = {}): RollResult {
  const p = parseDice(expr) ?? { dice: [], mod: 0 }
  const rolls: RollResult['rolls'] = []
  for (const d of p.dice) {
    const n = d.count * (opts.crit ? 2 : 1)
    for (let i = 0; i < n; i++) rolls.push({ sides: d.sides, value: rollDie(d.sides, rng), sign: d.sign })
  }
  const total = rolls.reduce((a, r) => a + r.sign * r.value, 0) + p.mod
  return { total, rolls, mod: p.mod }
}

export const rollTotal = (expr: string, rng?: Rng) => roll(expr, rng).total

/** Average value, used for monster HP and fixed level-up. */
export function average(expr: string): number {
  const p = parseDice(expr)
  if (!p) return 0
  return Math.floor(p.dice.reduce((a, d) => a + d.sign * d.count * (d.sides + 1) / 2, 0) + p.mod)
}

export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
