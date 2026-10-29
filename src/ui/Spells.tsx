import { useState } from 'react'
import { patch } from '../core/store'
import type { Ability, Character, DamageType, Spell } from '../core/types'
import { ABILITIES, DAMAGE_TYPES, uid } from '../core/types'
import { SPELLS, spellById, SCHOOLS } from '../data/spells'
import { casterInfo, enableCasting, longRest, shortRest, slotsFor, spellAttack, spellDC } from '../rules/character'
import { fmtMod } from '../core/dice'
import { Field, Seg, Stepper, confirmBox, toast } from './kit'

export function SpellsPanel({ c, editable }: { c: Character; editable: boolean }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'class' | 'all'>('class')
  const [custom, setCustom] = useState<Spell | null>(null)
  const [manual, setManual] = useState(false)
  const save = (fn: (x: Character) => Character) => patch('chars', c.id, fn)
  if (!c.caster) {
    return (
      <div className="stack">
        <p className="muted">{casterInfo(c.cls) ? `${c.cls}s cast spells.` : `${c.cls || 'This class'} doesn't cast by default, but any character can.`}</p>
        {editable && <button className="btn primary" onClick={() => save(enableCasting)}>✨ Enable spellcasting for this character</button>}
      </div>
    )
  }
  const cs = c.caster
  const clsKey = c.cls.toLowerCase()
  const known = cs.known.map((id) => spellById(id, cs.custom)).filter(Boolean) as Spell[]
  const pool = [...SPELLS, ...cs.custom].filter((s) => !cs.known.includes(s.id) && (scope === 'all' || s.custom || s.classes.some((k) => clsKey.includes(k))) && s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  const toggleSlot = (lvl: number, i: number) => editable && save((x) => ({ ...x, caster: { ...x.caster!, used: x.caster!.used.map((u, j) => (j === lvl ? (i < u ? i : i + 1) : u)) } }))
  return (
    <div className="stack">
      <div className="row between">
        <div className="row"><span className="pill">Save DC {spellDC(c)}</span><span className="pill">Spell attack {fmtMod(spellAttack(c))}</span>
          {editable && <select style={{ width: 'auto' }} value={cs.ability} onChange={(e) => save((x) => ({ ...x, caster: { ...x.caster!, ability: e.target.value as Ability } }))}>{ABILITIES.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}</select>}
        </div>
        {editable && <div className="row"><button className="btn small" onClick={() => { save(shortRest); toast(cs.pact ? 'Short rest: pact slots back' : 'Short rest taken') }}>Short rest</button><button className="btn small" onClick={() => { save(longRest); toast('Long rest: HP, slots and daily effects reset', 'good') }}>Long rest</button></div>}
      </div>
      <div className="card stack">
        <div className="row between"><div className="label">Spell slots{cs.pact ? ' (pact magic)' : ''}</div>{editable && <button className="btn small ghost" onClick={() => setManual(!manual)}>{manual ? 'Done' : 'Edit slots'}</button>}</div>
        {cs.max.map((m, lvl) => (m > 0 || manual) && (
          <div key={lvl} className="slotrow"><span className="label" style={{ width: 28 }}>L{lvl + 1}</span>
            {manual ? <Stepper value={m} min={0} max={9} onChange={(n) => save((x) => ({ ...x, caster: { ...x.caster!, manual: true, max: x.caster!.max.map((v, j) => (j === lvl ? n : v)) } }))} />
              : Array.from({ length: m }, (_, i) => <button key={i} className={`slot ${i < cs.used[lvl] ? 'used' : ''}`} aria-label={`Level ${lvl + 1} slot ${i + 1}`} onClick={() => toggleSlot(lvl, i)} />)}
          </div>
        ))}
        {manual && casterInfo(c.cls) && <button className="btn small" onClick={() => save((x) => ({ ...x, caster: { ...x.caster!, manual: false, ...slotsFor(x.cls, x.level) } }))}>Fill from class & level</button>}
        {!cs.max.some(Boolean) && !manual && <span className="muted">No slots at this level. Cantrips still work.</span>}
      </div>
      <div className="label">Known spells</div>
      {known.length ? known.sort((a, b) => a.level - b.level).map((s) => (
        <details key={s.id} className="card tight">
          <summary>{s.level ? `L${s.level}` : 'Cantrip'} · {s.name}{s.conc ? ' (C)' : ''}{s.damage ? ` — ${s.damage} ${s.damageType}` : s.heal ? ` — heals ${s.heal}` : ''}</summary>
          <p className="muted" style={{ fontSize: '.88rem' }}>{s.school} · {s.time} · {s.range} · {s.duration}</p>
          <p>{s.desc}</p>
          {editable && <button className="btn small ghost" onClick={() => save((x) => ({ ...x, caster: { ...x.caster!, known: x.caster!.known.filter((k) => k !== s.id) } }))}>Forget</button>}
        </details>
      )) : <span className="muted">None yet. Search below.</span>}
      {editable && (
        <>
          <div className="row"><input id="spell-search" placeholder="Search spells" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} /><Seg value={scope} onChange={setScope} options={[{ id: 'class', label: c.cls || 'Class' }, { id: 'all', label: 'All' }]} /></div>
          <div className="stack">{pool.map((s) => (
            <div key={s.id} className="item"><div className="meta"><div className="name">{s.name}</div><div className="sub">{s.level ? `Level ${s.level}` : 'Cantrip'} · {s.school}{s.custom ? ' · custom' : ''}</div></div>
              <button className="btn small" onClick={() => save((x) => ({ ...x, caster: { ...x.caster!, known: [...x.caster!.known, s.id] } }))}>Learn</button></div>
          ))}</div>
          {custom ? (
            <div className="card stack">
              <div className="grid2">
                <Field label="Name"><input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></Field>
                <Field label="Level (0 = cantrip)"><Stepper value={custom.level} min={0} max={9} onChange={(n) => setCustom({ ...custom, level: n })} /></Field>
                <Field label="School"><select value={custom.school} onChange={(e) => setCustom({ ...custom, school: e.target.value })}>{SCHOOLS.map((x) => <option key={x}>{x}</option>)}</select></Field>
                <Field label="Damage dice (optional)"><input value={custom.damage ?? ''} onChange={(e) => setCustom({ ...custom, damage: e.target.value || undefined })} placeholder="e.g. 2d8" /></Field>
                <Field label="Damage type"><select value={custom.damageType ?? 'force'} onChange={(e) => setCustom({ ...custom, damageType: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Healing dice (optional)"><input value={custom.heal ?? ''} onChange={(e) => setCustom({ ...custom, heal: e.target.value || undefined })} /></Field>
              </div>
              <label className="toggle"><input type="checkbox" checked={!!custom.attack} onChange={(e) => setCustom({ ...custom, attack: e.target.checked })} /> Uses a spell attack roll (otherwise a save)</label>
              <Field label="What it does"><textarea value={custom.desc} onChange={(e) => setCustom({ ...custom, desc: e.target.value })} /></Field>
              <div className="row end"><button className="btn ghost" onClick={() => setCustom(null)}>Cancel</button><button className="btn primary" onClick={() => { const sp = { ...custom, id: 'custom-' + uid(), save: custom.attack ? undefined : ('dex' as const) }; save((x) => ({ ...x, caster: { ...x.caster!, custom: [...x.caster!.custom, sp], known: [...x.caster!.known, sp.id] } })); setCustom(null) }}>Save spell</button></div>
            </div>
          ) : <button className="btn" onClick={() => setCustom({ id: '', name: 'New spell', level: 1, school: 'Evocation', time: '1 action', range: '60 ft', duration: 'Instantaneous', classes: [], desc: '', custom: true })}>＋ Custom spell</button>}
          <button className="btn ghost danger" style={{ color: 'var(--bad)' }} onClick={async () => { if (await confirmBox('Turn off spellcasting? Known spells and slots are cleared.', 'Turn off', true)) save((x) => ({ ...x, caster: undefined })) }}>Turn off spellcasting</button>
        </>
      )}
    </div>
  )
}
