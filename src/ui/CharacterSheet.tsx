import { useState } from 'react'
import { roll, fmtMod } from '../core/dice'
import { del, patch, setDoc, useApp } from '../core/store'
import { usePlayerLabel, useRole } from '../core/role'
import type { Ability, Character } from '../core/types'
import { ABILITIES, ABILITY_NAMES, uid } from '../core/types'
import {
  INSPIRATION_MAX, SKILLS, acOf, amod, armorOf, attacksOf, bodyArmor, giveInspiration, hitDieAverage, levelUp, longRest, mod, prof, score, shortRest,
} from '../rules/character'
import { armorLines } from '../rules/armor'
import { TraitEditor } from '../screens/Battle'
import { BodyDoll, Inventory } from './Inventory'
import { PortraitPicker } from './Portrait'
import { SpellsPanel } from './Spells'
import { Field, HpBar, Seg, Sheet, Stepper, confirmBox, toast } from './kit'

export function CharacterSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const c = s.cols.chars[id]
  const [tab, setTab] = useState<'sheet' | 'gear' | 'spells' | 'about'>('sheet')
  const [lvl, setLvl] = useState(false)
  const [photo, setPhoto] = useState(false)
  if (!c) return null
  const edit = role.canEdit(c)
  const set = (fn: (x: Character) => Character) => patch('chars', c.id, fn)
  return (
    <Sheet title={label(c)} onClose={onClose} wide>
      <div className="row nowrap">
        <button className="avatar big" onClick={() => edit && setPhoto(true)} aria-label="Portrait photo" style={{ cursor: edit ? 'pointer' : 'default' }}>{c.portrait ? <img src={c.portrait} alt="" width={84} height={84} style={{ objectFit: 'cover' }} /> : c.name.slice(0, 1)}</button>
        <div className="grow stack" style={{ gap: 4 }}>
          <div className="muted">Level {c.level} {c.subrace || c.race} {c.cls}{c.background ? ` · ${c.background}` : ''}</div>
          <HpBar hp={c.hp} max={c.maxHp} temp={c.tempHp} />
          <div className="row">
            <span className="pill">AC {acOf(c)}</span><span className="pill">Prof {fmtMod(prof(c))}</span><span className="pill">Speed {c.speed} ft</span>
            <span className="pill" title="Inspiration">Inspiration <span className="pips">{Array.from({ length: INSPIRATION_MAX }, (_, i) => <span key={i} className={`pip ${i < c.inspiration ? 'on' : ''}`} />)}</span></span>
          </div>
        </div>
      </div>
      <div className="row">
        {role.isDM && <button className="btn small" onClick={() => { const n = giveInspiration(c); if (!n) return toast(`${c.name} already has ${INSPIRATION_MAX} inspiration.`); patch('chars', c.id, () => n); toast(`${c.name} gains inspiration`, 'good') }}>✨ Give inspiration</button>}
        {edit && c.inspiration > 0 && <button className="btn small" onClick={() => set((x) => ({ ...x, inspiration: x.inspiration - 1 }))}>Spend inspiration</button>}
        {edit && c.level < 20 && <button className="btn small primary" onClick={() => setLvl(true)}>⬆ Level up</button>}
        {edit && <button className="btn small" onClick={() => { set(shortRest); toast('Short rest') }}>Short rest</button>}
        {edit && <button className="btn small" onClick={() => { set(longRest); toast('Long rest: full HP, slots and daily armor powers back', 'good') }}>Long rest</button>}
      </div>
      {c.levelTasks && <LevelTasks c={c} edit={edit} />}
      <Seg value={tab} onChange={setTab} options={[{ id: 'sheet', label: 'Sheet' }, { id: 'gear', label: 'Gear' }, { id: 'spells', label: 'Spells' }, { id: 'about', label: 'About' }]} />
      {tab === 'sheet' && <SheetTab c={c} edit={edit} />}
      {tab === 'gear' && <><BodyDoll c={c} /><ArmorSummary c={c} /><Inventory c={c} editable={edit} /></>}
      {tab === 'spells' && <SpellsPanel c={c} editable={edit} />}
      {tab === 'about' && <AboutTab c={c} edit={edit} onClose={onClose} />}
      {lvl && <LevelUpSheet c={c} onClose={() => setLvl(false)} />}
      {photo && <PortraitPicker onPick={(p) => set((x) => ({ ...x, portrait: p }))} onClose={() => setPhoto(false)} />}
    </Sheet>
  )
}

function ArmorSummary({ c }: { c: Character }) {
  if (!bodyArmor(c)) return null
  const st = armorOf(c)
  const lines = armorLines(st)
  return (
    <details className="card tight">
      <summary>What your armor does</summary>
      <ul style={{ margin: '6px 0', paddingLeft: 18 }}>{[...lines, ...st.notes].map((l, i) => <li key={i}>{l}</li>)}</ul>
      {st.shrug && <p className="muted">Shrug off: {c.shrugUsed ? 'used today' : 'ready'}</p>}
    </details>
  )
}

function SheetTab({ c, edit }: { c: Character; edit: boolean }) {
  const set = (fn: (x: Character) => Character) => patch('chars', c.id, fn)
  const [editing, setEditing] = useState(false)
  const p = prof(c)
  return (
    <div className="stack">
      <div className="abil">{ABILITIES.map((a) => (
        <div key={a}><small>{a}</small><b>{fmtMod(amod(c, a))}</b><span className="muted num">{score(c, a)}{c.bonuses[a] ? ` (${c.abilities[a]}+${c.bonuses[a]})` : ''}</span>
          {editing && <Stepper value={c.abilities[a]} min={1} max={30} onChange={(n) => set((x) => ({ ...x, abilities: { ...x.abilities, [a]: n } }))} />}
        </div>
      ))}</div>
      {edit && <button className="btn small ghost" onClick={() => setEditing(!editing)}>{editing ? 'Done editing' : '✎ Edit numbers'}</button>}
      {editing && (
        <div className="card grid2">
          <Field label="Max HP"><Stepper value={c.maxHp} min={1} onChange={(n) => set((x) => ({ ...x, maxHp: n, hp: Math.min(x.hp, n) }))} /></Field>
          <Field label="Current HP"><Stepper value={c.hp} min={0} max={c.maxHp} onChange={(n) => set((x) => ({ ...x, hp: n }))} /></Field>
          <Field label="AC override" hint="Blank = worked out from armor"><input inputMode="numeric" value={c.acManual ?? ''} onChange={(e) => set((x) => ({ ...x, acManual: e.target.value === '' ? null : +e.target.value || 0 }))} /></Field>
          <Field label="Proficiency override" hint="Blank = from level"><input inputMode="numeric" value={c.profOverride ?? ''} onChange={(e) => set((x) => ({ ...x, profOverride: e.target.value === '' ? null : +e.target.value || 0 }))} /></Field>
          <Field label="Speed"><Stepper value={c.speed} min={0} step={5} onChange={(n) => set((x) => ({ ...x, speed: n }))} /></Field>
          <Field label="Hit die"><select value={c.hitDie} onChange={(e) => set((x) => ({ ...x, hitDie: +e.target.value }))}>{[6, 8, 10, 12].map((d) => <option key={d} value={d}>d{d}</option>)}</select></Field>
        </div>
      )}
      <div className="grid2">
        <div className="card stack">
          <div className="label">Saving throws</div>
          {ABILITIES.map((a) => {
            const on = c.saves.includes(a)
            return <label key={a} className="toggle"><input type="checkbox" disabled={!editing} checked={on} onChange={() => set((x) => ({ ...x, saves: on ? x.saves.filter((y) => y !== a) : [...x.saves, a] }))} /><span className="grow">{ABILITY_NAMES[a]}</span><b className="num">{fmtMod(amod(c, a) + (on ? p : 0))}</b></label>
          })}
          {c.customSaves.map((cs) => <div key={cs.id} className="row between"><span>{cs.name}</span><span className="row"><b className="num">{fmtMod(cs.bonus)}</b>{editing && <button className="btn small ghost" onClick={() => set((x) => ({ ...x, customSaves: x.customSaves.filter((y) => y.id !== cs.id) }))}>✕</button>}</span></div>)}
          {editing && <CustomSaveAdd onAdd={(name, bonus) => set((x) => ({ ...x, customSaves: [...x.customSaves, { id: uid(), name, bonus }] }))} />}
        </div>
        <div className="card stack">
          <div className="label">Skills</div>
          {SKILLS.map(([sk, ab]) => {
            const on = c.skills.includes(sk)
            return <label key={sk} className="toggle" style={{ fontSize: '.92rem' }}><input type="checkbox" disabled={!editing} checked={on} onChange={() => set((x) => ({ ...x, skills: on ? x.skills.filter((y) => y !== sk) : [...x.skills, sk] }))} /><span className="grow">{sk} <small>({ab})</small></span><b className="num">{fmtMod(mod(score(c, ab as Ability)) + (on ? p : 0))}</b></label>
          })}
        </div>
      </div>
      <div className="card stack">
        <div className="label">Attacks</div>
        {attacksOf(c).map((a) => <div key={a.id} className="row between"><span>{a.name}</span><span className="num">{fmtMod(a.toHit)} · {a.damage} {a.damageType}{a.bonusDice ? ` +${a.bonusDice} ${a.bonusType}` : ''}</span></div>)}
        {!attacksOf(c).length && <span className="muted">Equip a weapon on the Gear tab, or add one by hand.</span>}
        {edit && <AttackAdd c={c} />}
      </div>
      <div className="card stack">
        <div className="label">Combat traits & homebrew</div>
        {edit ? <TraitEditor traits={c.traits} onChange={(traits) => set((x) => ({ ...x, traits }))} /> : <div className="row">{c.traits.map((t) => <span key={t.id} className="pill">{t.effect === 'custom' ? t.text : `${t.effect}: ${(t.types ?? []).join(', ')}`}</span>)}</div>}
      </div>
      {c.features.length > 0 && (
        <div className="card stack"><div className="label">Features</div>{c.features.map((f, i) => <details key={i}><summary>{f.name}</summary><p className="muted" style={{ fontSize: '.9rem' }}>{f.desc}</p></details>)}</div>
      )}
    </div>
  )
}

function CustomSaveAdd({ onAdd }: { onAdd: (n: string, b: number) => void }) {
  const [n, setN] = useState('')
  const [b, setB] = useState(0)
  return <div className="row"><input placeholder="Custom save, e.g. vs poison" value={n} onChange={(e) => setN(e.target.value)} style={{ flex: 1 }} /><Stepper value={b} onChange={setB} /><button className="btn small" disabled={!n.trim()} onClick={() => { onAdd(n.trim(), b); setN('') }}>Add</button></div>
}
function AttackAdd({ c }: { c: Character }) {
  const [open, setOpen] = useState(false)
  const [a, setA] = useState({ name: '', toHit: prof(c), damage: '1d6', damageType: 'slashing' as const })
  if (!open) return <button className="btn small ghost" onClick={() => setOpen(true)}>＋ Attack by hand</button>
  return (
    <div className="row">
      <input placeholder="Name" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} style={{ flex: '2 1 120px' }} />
      <Stepper value={a.toHit} onChange={(n) => setA({ ...a, toHit: n })} />
      <input value={a.damage} onChange={(e) => setA({ ...a, damage: e.target.value })} style={{ flex: '1 1 70px' }} />
      <button className="btn small" disabled={!a.name.trim()} onClick={() => { patch('chars', c.id, (x) => ({ ...x, attacks: [...x.attacks, { ...a, id: uid() }] })); setOpen(false) }}>Add</button>
    </div>
  )
}

function AboutTab({ c, edit, onClose }: { c: Character; edit: boolean; onClose: () => void }) {
  const s = useApp()
  const role = useRole()
  const set = (fn: (x: Character) => Character) => patch('chars', c.id, fn)
  return (
    <div className="stack">
      <div className="grid2">
        <Field label="Character name"><input value={c.name} disabled={!edit} onChange={(e) => set((x) => ({ ...x, name: e.target.value }))} /></Field>
        {s.viewer.mode === 'local' && <Field label="Player name" hint="Shown as Character (Player). Leave blank for none."><input value={c.playerName ?? ''} disabled={!edit} onChange={(e) => set((x) => ({ ...x, playerName: e.target.value }))} /></Field>}
      </div>
      <Field label="Character details" hint="Appearance, voice, mannerisms"><textarea value={c.details ?? ''} disabled={!edit} onChange={(e) => set((x) => ({ ...x, details: e.target.value }))} /></Field>
      <Field label="Notes"><textarea value={c.notes ?? ''} disabled={!edit} onChange={(e) => set((x) => ({ ...x, notes: e.target.value }))} /></Field>
      {edit && c.portrait && <button className="btn small ghost" onClick={() => set((x) => ({ ...x, portrait: undefined }))}>Remove portrait photo</button>}
      {role.isDM && <button className="btn danger" onClick={async () => { if (await confirmBox(`Delete ${c.name} for good?`, 'Delete', true)) { del('chars', c.id); setDoc('encounter', (e) => ({ ...e, combatants: e.combatants.filter((x) => x.characterId !== c.id) })); onClose() } }}>Delete character</button>}
    </div>
  )
}

function LevelTasks({ c, edit }: { c: Character; edit: boolean }) {
  const t = c.levelTasks!
  const keys = (['asi', 'feat', 'spells'] as const).filter((k) => t[k] !== undefined)
  if (!keys.length) return null
  const names = { asi: 'Ability score increase', feat: '…or take a feat instead', spells: 'Pick new spells' }
  const done = keys.every((k) => t[k])
  return (
    <div className="banner stack" style={{ gap: 6 }}>
      <b>Level {t.level} checklist</b>
      {keys.map((k) => <label key={k} className="toggle"><input type="checkbox" disabled={!edit} checked={!!t[k]} onChange={(e) => patch('chars', c.id, (x) => ({ ...x, levelTasks: { ...x.levelTasks!, [k]: e.target.checked } }))} />{names[k]}</label>)}
      {done && edit && <button className="btn small" onClick={() => patch('chars', c.id, (x) => ({ ...x, levelTasks: undefined }))}>All done</button>}
    </div>
  )
}

export function LevelUpSheet({ c, onClose }: { c: Character; onClose: () => void }) {
  const [how, setHow] = useState<'roll' | 'table' | 'avg'>('roll')
  const [typed, setTyped] = useState(Math.ceil(c.hitDie / 2))
  const [rolled, setRolled] = useState<number | null>(null)
  const die = how === 'avg' ? hitDieAverage(c.hitDie) : how === 'table' ? typed : rolled
  const go = () => { if (die == null) return; patch('chars', c.id, (x) => levelUp(x, die)); onClose() }
  return (
    <Sheet title={`${c.name} → level ${c.level + 1}`} onClose={onClose}>
      <p>Hit die d{c.hitDie} + CON {fmtMod(amod(c, 'con'))} (at least 1).</p>
      <Seg value={how} onChange={setHow} options={[{ id: 'roll', label: 'Roll here' }, { id: 'table', label: 'Rolled at the table' }, { id: 'avg', label: `Fixed average (${hitDieAverage(c.hitDie)})` }]} />
      {how === 'roll' && <button className="btn" onClick={() => setRolled(roll(`1d${c.hitDie}`).total)}>🎲 Roll d{c.hitDie}{rolled != null ? ` — got ${rolled}` : ''}</button>}
      {how === 'table' && <Field label={`Your d${c.hitDie} roll`}><Stepper value={typed} min={1} max={c.hitDie} onChange={setTyped} /></Field>}
      {die != null && <p className="big-total">+{Math.max(1, die + amod(c, 'con'))} HP</p>}
      <button className="btn primary" disabled={die == null} onClick={go}>Level up</button>
    </Sheet>
  )
}
