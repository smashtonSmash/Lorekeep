import { useMemo, useRef, useState } from 'react'
import { roll } from '../core/dice'
import { list, patch, put, setDoc, setLocal, useApp } from '../core/store'
import { usePlayerLabel, useRole } from '../core/role'
import type { Ability, Character, Item } from '../core/types'
import { ABILITIES, ABILITY_NAMES, uid } from '../core/types'
import { BACKGROUNDS, CLASSES, RACES, type CustomOrigin } from '../data/origins'
import { acOf, addItem, casterInfo, enableCasting, hitDieAverage, levelUp, mod, toggleEquip } from '../rules/character'
import { makeArmor, makeConsumable, makeWeapon, WEAPONS } from '../rules/gear'
import { ARMOR } from '../rules/armor'
import { CharacterSheet } from '../ui/CharacterSheet'
import { Offers } from '../ui/Inventory'
import { PortraitPicker } from '../ui/Portrait'
import { Empty, Field, HpBar, Seg, Sheet, Stepper, confirmBox, toast } from '../ui/kit'

export default function Characters() {
  const s = useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const chars = list('chars').sort((a, b) => a.createdAt - b.createdAt)
  const mine = chars.filter(role.mine)
  const others = chars.filter((c) => !role.mine(c))
  const claimable = (c: Character) => role.table && !role.isDM && !c.ownerId && !role.readOnly
  const card = (c: Character) => (
    <div key={c.id} className="card stack" style={{ cursor: 'pointer' }} onClick={() => setOpen(c.id)}>
      <div className="row nowrap">
        <div className="avatar" style={{ width: 48, height: 48 }}>{c.portrait ? <img src={c.portrait} alt="" width={48} height={48} style={{ objectFit: 'cover' }} /> : c.name.slice(0, 1)}</div>
        <div className="grow"><h3>{label(c)}</h3><div className="muted" style={{ fontSize: '.88rem' }}>L{c.level} {c.subrace || c.race} {c.cls}{!c.playerName && !c.ownerId && s.viewer.mode === 'table' ? ' · not claimed' : ''}</div></div>
        <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}><span className="ac">{acOf(c)}</span>{c.sample && <span className="tag" style={{ color: 'var(--muted)' }}>SAMPLE</span>}</div>
      </div>
      <HpBar hp={c.hp} max={c.maxHp} temp={c.tempHp} />
      {c.inspiration > 0 && <span className="pill">✨ Inspiration ×{c.inspiration}</span>}
      {claimable(c) && <button className="btn small primary" onClick={(e) => { e.stopPropagation(); patch('chars', c.id, (x) => ({ ...x, ownerId: s.viewer.id ?? undefined })); toast(`${c.name} is yours now`, 'good') }}>This is my character</button>}
      {role.mine(c) && <div onClick={(e) => e.stopPropagation()}><Offers c={c} /></div>}
    </div>
  )
  return (
    <div className="stack">
      <div className="row between">
        <h2>{role.isDM ? 'Characters' : 'Your characters'}</h2>
        <div className="row">
          {role.isDM && chars.length > 0 && <button className="btn small" onClick={async () => { if (await confirmBox('Level up everyone using the fixed average hit die?', 'Level up all')) { chars.forEach((c) => patch('chars', c.id, (x) => levelUp(x, hitDieAverage(x.hitDie)))); toast('Everyone levels up!', 'good') } }}>⬆ Level up all</button>}
          {!role.readOnly && <button className="btn primary" onClick={() => setCreating(true)}>＋ New character</button>}
        </div>
      </div>
      <div className="grid2">{(role.isDM ? chars : mine).map(card)}</div>
      {!chars.length && <Empty>No characters yet. Tap “New character” to open the book.</Empty>}
      {!role.isDM && mine.length === 0 && chars.length > 0 && <Empty>None of these are yours yet. {role.table ? 'Make a new one, or claim one below.' : 'Pick yours under 🎲 Player at the top.'}</Empty>}
      {!role.isDM && others.length > 0 && <><div className="label">The rest of the party</div><div className="grid2">{others.map(card)}</div></>}
      {open && <CharacterSheet id={open} onClose={() => setOpen(null)} />}
      {creating && <CreateBook onClose={() => setCreating(false)} onMade={(id) => { setCreating(false); setOpen(id) }} />}
    </div>
  )
}

// ---------- the creation book ----------
interface Draft {
  race: string; subrace: string; customRace?: CustomOrigin
  cls: string; customCls?: CustomOrigin
  bg: string; customBg?: CustomOrigin
  flexible: false | '2-1' | '1-1-1'; flex: Ability[]
  customBonus: Partial<Record<Ability, number>>
  classSkills: string[]
  scores: Record<Ability, number> | null
  name: string; player: string; details: string; portrait?: string
  weapon: string; armor: string
}
const PAGES = ['🧬 Origins', '🎲 Abilities', '✍️ Details', '🎒 Gear']

function CreateBook({ onClose, onMade }: { onClose: () => void; onMade: (id: string) => void }) {
  const s = useApp()
  const role = useRole()
  const [page, setPage] = useState(0)
  const [d, setD] = useState<Draft>({ race: 'Human', subrace: '', cls: 'Fighter', bg: 'Acolyte', flexible: false, flex: [], customBonus: {}, classSkills: [], scores: null, name: '', player: '', details: '', weapon: 'longsword', armor: 'leather' })
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const race = RACES.find((r) => r.name === d.race)
  const sub = race?.subraces?.find((x) => x.name === d.subrace)
  const cls = CLASSES.find((c) => c.name === d.cls)
  const bg = BACKGROUNDS.find((b) => b.name === d.bg)
  const library = s.docs.library.items

  const bonuses = useMemo(() => {
    const out: Partial<Record<Ability, number>> = {}
    const add = (a: string, n: number) => { out[a as Ability] = (out[a as Ability] ?? 0) + n }
    if (d.customRace) Object.entries(d.customBonus).forEach(([a, n]) => add(a, n!))
    else if (d.flexible) { const pat = d.flexible === '2-1' ? [2, 1] : [1, 1, 1]; d.flex.forEach((a, i) => pat[i] && add(a, pat[i])) }
    else { Object.entries(race?.bonuses ?? {}).forEach(([a, n]) => add(a, n)); Object.entries(sub?.bonuses ?? {}).forEach(([a, n]) => add(a, n)) }
    return out
  }, [d, race, sub])

  const finish = () => {
    const sc = d.scores ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    const hitDie = d.customCls?.hitDie ?? cls?.hitDie ?? 8
    const con = mod(sc.con + (bonuses.con ?? 0))
    const features = [
      ...(d.customRace ? [{ name: d.customRace.name, desc: d.customRace.desc }] : [...(race?.traits ?? []), ...(sub?.traits ?? [])]),
      ...(d.customCls ? [{ name: d.customCls.name, desc: d.customCls.desc }] : cls?.features ?? []),
      ...(d.customBg ? [{ name: d.customBg.name, desc: d.customBg.desc }] : bg ? [bg.feature] : []),
    ]
    let c: Character = {
      id: uid(), name: d.name.trim() || 'Unnamed hero', playerName: d.player.trim() || undefined,
      ownerId: role.table && !role.isDM ? s.viewer.id ?? undefined : undefined,
      race: d.customRace?.name ?? d.race, subrace: d.customRace ? undefined : d.subrace || undefined, cls: d.customCls?.name ?? d.cls, background: d.customBg?.name ?? d.bg,
      level: 1, abilities: sc, bonuses, hitDie, maxHp: Math.max(1, hitDie + con), hp: Math.max(1, hitDie + con), tempHp: 0, speed: race?.speed ?? 30,
      saves: ((d.customCls?.saves ?? cls?.saves ?? []) as Ability[]), customSaves: [],
      skills: [...new Set([...d.classSkills, ...(d.customBg?.skills ?? bg?.skills ?? [])])],
      traits: [], features, attacks: [], inventory: [], purse: { gold: 10, silver: 0 }, portrait: d.portrait, details: d.details || undefined,
      conditions: [], effects: [], favor: {}, inspiration: 0, createdAt: Date.now(),
    }
    // starting gear (only at creation — after this, items come from the DM, loot, shops and trades)
    const kit: Item[] = [makeWeapon(d.weapon, 'green'), ...(d.armor ? [makeArmor(d.armor, 'green')] : []), makeConsumable('heal-green')]
    for (const it of kit) { c = addItem(c, it); if (it.kind !== 'consumable') c = toggleEquip(c, c.inventory[c.inventory.length - 1].id).char }
    if (casterInfo(c.cls)) c = enableCasting(c)
    put('chars', c)
    if (!role.table && !role.isDM) setLocal((l) => ({ ...l, playerChars: [...l.playerChars, c.id] }))
    toast(`${c.name} joins the party!`, 'good')
    onMade(c.id)
  }

  return (
    <Sheet title="New character" onClose={onClose} wide>
      <div className="book-steps">{PAGES.map((p, i) => <span key={p} className={i <= page ? 'on' : ''} />)}</div>
      <div className="row between"><h3>{PAGES[page]}</h3><span className="muted">Page {page + 1} of {PAGES.length}</span></div>
      <div className="page">
        {page === 0 && (
          <>
            <Field label="Race">
              <select value={d.customRace ? `custom:${d.customRace.id}` : d.race} onChange={(e) => { const v = e.target.value; if (v.startsWith('custom:')) up({ customRace: library.find((x) => x.id === v.slice(7)) }); else up({ race: v, subrace: '', customRace: undefined }) }}>
                {RACES.map((r) => <option key={r.key}>{r.name}</option>)}
                {library.filter((x) => x.kind === 'race').map((x) => <option key={x.id} value={`custom:${x.id}`}>★ {x.name}</option>)}
              </select>
            </Field>
            {!d.customRace && race?.subraces?.length ? <Field label="Subrace"><select value={d.subrace} onChange={(e) => up({ subrace: e.target.value })}><option value="">—</option>{race.subraces.map((x) => <option key={x.key}>{x.name}</option>)}</select></Field> : null}
            {!d.customRace && (
              <div className="stack">
                <label className="toggle"><input type="checkbox" checked={!!d.flexible} onChange={(e) => up({ flexible: e.target.checked ? '2-1' : false, flex: [] })} /> Standard flexible origin: +2/+1 or +1/+1/+1</label>
                {d.flexible && <><Seg value={d.flexible} onChange={(v) => up({ flexible: v, flex: [] })} options={[{ id: '2-1', label: '+2 / +1' }, { id: '1-1-1', label: '+1 / +1 / +1' }]} />
                  <div className="row">{ABILITIES.map((a) => { const i = d.flex.indexOf(a); const max = d.flexible === '2-1' ? 2 : 3; return <button key={a} className={`chip ${i >= 0 ? 'on' : ''}`} onClick={() => up({ flex: i >= 0 ? d.flex.filter((x) => x !== a) : d.flex.length < max ? [...d.flex, a] : d.flex })}>{a.toUpperCase()}{i >= 0 ? ` +${d.flexible === '2-1' ? (i === 0 ? 2 : 1) : 1}` : ''}</button> })}</div></>}
              </div>
            )}
            {d.customRace && <CustomBonus budget={s.docs.settings.originBudget} value={d.customBonus} onChange={(customBonus) => up({ customBonus })} />}
            <p className="muted">Ability bonuses: {Object.entries(bonuses).map(([a, n]) => `${a.toUpperCase()} +${n}`).join(', ') || 'none'}</p>
            <Field label="Class">
              <select value={d.customCls ? `custom:${d.customCls.id}` : d.cls} onChange={(e) => { const v = e.target.value; if (v.startsWith('custom:')) up({ customCls: library.find((x) => x.id === v.slice(7)), classSkills: [] }); else up({ cls: v, customCls: undefined, classSkills: [] }) }}>
                {CLASSES.map((c) => <option key={c.key}>{c.name}</option>)}
                {library.filter((x) => x.kind === 'class').map((x) => <option key={x.id} value={`custom:${x.id}`}>★ {x.name}</option>)}
              </select>
            </Field>
            {!d.customCls && cls && (
              <div className="stack">
                <p className="muted">Hit die d{cls.hitDie} · Saves {cls.saves.map((x) => x.toUpperCase()).join(', ')} (automatic)</p>
                <div className="label">Choose {cls.skillChoice.choose} skills</div>
                <div className="row">{cls.skillChoice.from.map((sk) => { const on = d.classSkills.includes(sk); return <button key={sk} className={`chip ${on ? 'on' : ''}`} onClick={() => up({ classSkills: on ? d.classSkills.filter((x) => x !== sk) : d.classSkills.length < cls.skillChoice.choose ? [...d.classSkills, sk] : d.classSkills })}>{sk}</button> })}</div>
              </div>
            )}
            <Field label="Background">
              <select value={d.customBg ? `custom:${d.customBg.id}` : d.bg} onChange={(e) => { const v = e.target.value; if (v.startsWith('custom:')) up({ customBg: library.find((x) => x.id === v.slice(7)) }); else up({ bg: v, customBg: undefined }) }}>
                {BACKGROUNDS.map((b) => <option key={b.key}>{b.name}</option>)}
                {library.filter((x) => x.kind === 'background').map((x) => <option key={x.id} value={`custom:${x.id}`}>★ {x.name}</option>)}
              </select>
            </Field>
            {!d.customBg && bg && <p className="muted">Skills {bg.skills.join(', ')} (automatic) · {bg.feature.name}</p>}
            <NewOrigin />
          </>
        )}
        {page === 1 && <AbilityGen bonuses={bonuses} value={d.scores} onChange={(scores) => up({ scores })} allowReroll={s.docs.settings.allowReroll || role.isDM} />}
        {page === 2 && (
          <>
            <Field label="Character name"><input id="new-char-name" value={d.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. Brannoc Stoutheart" /></Field>
            {!role.table && <Field label="Player name (optional)" hint="Shows as Character (Player)"><input value={d.player} onChange={(e) => up({ player: e.target.value })} /></Field>}
            <Field label="Character details" hint="What do they look like?"><textarea value={d.details} onChange={(e) => up({ details: e.target.value })} /></Field>
            <PortraitButton value={d.portrait} onChange={(portrait) => up({ portrait })} />
          </>
        )}
        {page === 3 && (
          <>
            <p className="muted">Pick a starting weapon and armor (Common). After today, new gear comes from the DM, loot, the town and trades.</p>
            <Field label="Weapon"><select value={d.weapon} onChange={(e) => up({ weapon: e.target.value })}>{WEAPONS.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.damage} {w.type})</option>)}</select></Field>
            <Field label="Armor"><select value={d.armor} onChange={(e) => up({ armor: e.target.value })}><option value="">No armor</option>{ARMOR.filter((a) => a.cat !== 'heavy' || /fighter|paladin|cleric/i.test(d.cls)).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.cat}, AC {a.base})</option>)}</select></Field>
            <p className="muted">Plus a Common Healing Potion and 10 gold.</p>
          </>
        )}
      </div>
      <div className="row between">
        <button className="btn ghost" onClick={() => (page ? setPage(page - 1) : onClose())}>{page ? '◂ Back' : 'Cancel'}</button>
        {page < PAGES.length - 1 ? <button className="btn primary" onClick={() => { if (page === 1 && !d.scores) return toast('Set your ability scores first.', 'bad'); setPage(page + 1) }}>Next ▸</button> : <button className="btn primary" onClick={finish}>Create character</button>}
      </div>
    </Sheet>
  )
}

function CustomBonus({ budget, value, onChange }: { budget: number; value: Partial<Record<Ability, number>>; onChange: (v: Partial<Record<Ability, number>>) => void }) {
  const used = Object.values(value).reduce((a, b) => a + (b ?? 0), 0)
  return (
    <div className="stack">
      <div className="label">Custom origin: spend {budget} ability points ({budget - used} left, max +2 each)</div>
      <div className="row">{ABILITIES.map((a) => <div key={a} className="stack" style={{ gap: 2, alignItems: 'center' }}><small>{a.toUpperCase()}</small><Stepper value={value[a] ?? 0} min={0} max={Math.min(2, (value[a] ?? 0) + budget - used)} onChange={(n) => onChange({ ...value, [a]: n })} /></div>)}</div>
    </div>
  )
}

function NewOrigin() {
  const [o, setO] = useState<CustomOrigin | null>(null)
  if (!o) return <button className="btn small ghost" onClick={() => setO({ id: uid(), kind: 'race', name: '', desc: '', hitDie: 8 })}>★ Make a custom race, class or background</button>
  return (
    <div className="card stack">
      <Seg value={o.kind} onChange={(kind) => setO({ ...o, kind })} options={[{ id: 'race', label: 'Race' }, { id: 'class', label: 'Class' }, { id: 'background', label: 'Background' }]} />
      <Field label="Name"><input value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} /></Field>
      <Field label="What makes it special"><textarea value={o.desc} onChange={(e) => setO({ ...o, desc: e.target.value })} /></Field>
      {o.kind === 'class' && <Field label="Hit die"><select value={o.hitDie} onChange={(e) => setO({ ...o, hitDie: +e.target.value })}>{[6, 8, 10, 12].map((x) => <option key={x} value={x}>d{x}</option>)}</select></Field>}
      <p className="muted" style={{ fontSize: '.85rem' }}>Saved to the campaign library so everyone can pick it.</p>
      <div className="row end"><button className="btn ghost" onClick={() => setO(null)}>Cancel</button><button className="btn primary" disabled={!o.name.trim()} onClick={() => { setDoc('library', (l) => ({ items: [...l.items, { ...o, name: o.name.trim() }] })); toast(`${o.name} saved to the library`); setO(null) }}>Save</button></div>
    </div>
  )
}

function PortraitButton({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="row">
      <div className="avatar big">{value ? <img src={value} alt="" width={84} height={84} style={{ objectFit: 'cover' }} /> : '?'}</div>
      <button className="btn" onClick={() => setOpen(true)}>📷 {value ? 'Change photo' : 'Add a photo'}</button>
      {value && <button className="btn ghost small" onClick={() => onChange(undefined)}>Remove</button>}
      {open && <PortraitPicker onPick={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}

// ---------- ability generation ----------
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
const roll4d6 = () => { const dice = [0, 0, 0, 0].map(() => roll('1d6').total); const low = Math.min(...dice); return { dice, total: dice.reduce((a, b) => a + b, 0) - low } }

function AbilityGen({ bonuses, value, onChange, allowReroll }: { bonuses: Partial<Record<Ability, number>>; value: Record<Ability, number> | null; onChange: (v: Record<Ability, number>) => void; allowReroll: boolean }) {
  const [method, setMethod] = useState<'roll' | 'buy' | 'table'>('roll')
  const [rolls, setRolls] = useState<{ dice: number[]; total: number }[] | null>(null)
  const [assign, setAssign] = useState<Partial<Record<Ability, number>>>({}) // ability -> roll index
  const [sel, setSel] = useState<number | null>(null)
  const [buy, setBuy] = useState<Record<Ability, number>>({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })
  const [typed, setTyped] = useState<Record<Ability, number>>(value ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  const dragIdx = useRef<number | null>(null)
  const used = new Set(Object.values(assign))
  const place = (a: Ability, idx: number) => {
    const next = { ...assign }
    for (const k of Object.keys(next) as Ability[]) if (next[k] === idx) delete next[k]
    next[a] = idx
    setAssign(next); setSel(null)
    if (rolls && Object.keys(next).length === 6) onChange(Object.fromEntries(ABILITIES.map((ab) => [ab, rolls[next[ab]!].total])) as Record<Ability, number>)
  }
  const spent = ABILITIES.reduce((n, a) => n + POINT_COST[buy[a]], 0)
  const show = (a: Ability, base?: number) => base == null ? '—' : `${base}${bonuses[a] ? ` +${bonuses[a]}` : ''} → ${base + (bonuses[a] ?? 0)}`
  return (
    <>
      <Seg value={method} onChange={setMethod} options={[{ id: 'roll', label: '🎲 4d6 drop lowest' }, { id: 'buy', label: 'Point buy' }, { id: 'table', label: 'Rolled at the table' }]} />
      {method === 'roll' && (
        <>
          <button className="btn" disabled={!!rolls && !allowReroll} onClick={() => { setRolls(Array.from({ length: 6 }, roll4d6)); setAssign({}) }}>{rolls ? (allowReroll ? '🎲 Reroll all six' : 'Rerolls are off at this table') : '🎲 Roll 4d6 × 6 (drop lowest)'}</button>
          {rolls && (
            <>
              <p className="muted">Tap a result, then tap a stat — or drag it onto the stat.</p>
              <div className="pool">{rolls.map((r, i) => (
                <button key={i} className={`${used.has(i) ? 'used' : ''} ${sel === i ? 'sel' : ''}`} title={r.dice.join(' ')} onClick={() => setSel(i)}
                  onPointerDown={() => { dragIdx.current = i }} onPointerUp={(e) => { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ab]') as HTMLElement | null; if (el && dragIdx.current != null) place(el.dataset.ab as Ability, dragIdx.current); dragIdx.current = null }}>{r.total}</button>
              ))}</div>
              <div className="assign">{ABILITIES.map((a) => <button key={a} data-ab={a} className={assign[a] != null ? 'set' : ''} onClick={() => sel != null && place(a, sel)}><small className="label">{ABILITY_NAMES[a]}</small><div>{show(a, assign[a] != null ? rolls[assign[a]!].total : undefined)}</div></button>)}</div>
            </>
          )}
        </>
      )}
      {method === 'buy' && (
        <>
          <p className={spent > 27 ? 'pill bad' : 'muted'}>{27 - spent} of 27 points left (8–15 before bonuses)</p>
          <div className="grid2">{ABILITIES.map((a) => <div key={a} className="row between"><span>{ABILITY_NAMES[a]} <small>{show(a, buy[a])}</small></span><Stepper value={buy[a]} min={8} max={15} onChange={(n) => { const nb = { ...buy, [a]: n }; if (ABILITIES.reduce((m, x) => m + POINT_COST[nb[x]], 0) <= 27) { setBuy(nb); onChange(nb) } }} /></div>)}</div>
          <button className="btn small" onClick={() => onChange(buy)}>Use these</button>
        </>
      )}
      {method === 'table' && (
        <div className="grid2">{ABILITIES.map((a) => <div key={a} className="row between"><span>{ABILITY_NAMES[a]} <small>{show(a, typed[a])}</small></span><Stepper value={typed[a]} min={3} max={18} onChange={(n) => { const t = { ...typed, [a]: n }; setTyped(t); onChange(t) }} /></div>)}</div>
      )}
      {value && <p className="pill good">Scores set: {ABILITIES.map((a) => `${a.toUpperCase()} ${value[a] + (bonuses[a] ?? 0)}`).join(' · ')}</p>}
    </>
  )
}
