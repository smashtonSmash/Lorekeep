import { useEffect, useMemo, useRef, useState } from 'react'
import { flash } from '../ui/fx'
import { average, fmtMod, roll } from '../core/dice'
import { list, patch, setDoc, setLocal, useApp } from '../core/store'
import { usePlayerLabel, useRole } from '../core/role'
import type { Attack, Character, Combatant, Condition, DamageType, Item, Tier, TraitEffect } from '../core/types'
import { CONDITIONS, DAMAGE_ICON, DAMAGE_TYPES, TIERS, uid } from '../core/types'
import { MONSTERS } from '../data/monsters'
import { spellById } from '../data/spells'
import { addItem, amod, prof, removeItem, spellAttack, spellDC } from '../rules/character'
import { resolveAttack, type AttackResult } from '../rules/combat'
import { WEAPONS } from '../rules/gear'
import { ARMOR } from '../rules/armor'
import { guessTier, inferLoadout, rollLoot } from '../rules/loot'
import { TIER_COLOR, TIER_LABEL } from '../rules/tiers'
import { ItemArt } from '../ui/art'
import { Empty, Field, HpBar, RarityTag, Seg, Sheet, Stepper, confirmBox, toast } from '../ui/kit'
import { addLog, applyAttack, changeHp, defenderOf, endCombat, fighterOf, log, nextTurn, type Fighter } from './battleLogic'

export default function Battle() {
  const s = useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const enc = s.docs.encounter
  const chars = s.cols.chars
  const dm = role.isDM && !role.readOnly
  const fighters = useMemo(() => enc.combatants.map((c) => fighterOf(c, chars)), [enc.combatants, chars])
  const party = fighters.filter((f) => f.c.side === 'party')
  const monsters = fighters.filter((f) => f.c.side === 'monster')
  const [attack, setAttack] = useState<{ a: string; t: string } | null>(null)
  const [hpFor, setHpFor] = useState<string | null>(null)
  const [adding, setAdding] = useState<'party' | 'monster' | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [lootFor, setLootFor] = useState<{ id?: string; tier?: Tier } | null>(null)
  const drag = useDrag(dm, (a, t) => setAttack({ a, t }), (id) => {
    if (picked && picked !== id) { setAttack({ a: picked, t: id }); setPicked(null) } else setHpFor(id)
  })
  const byId = (id: string) => fighters.find((f) => f.c.id === id)
  const sortedBy = (fs: Fighter[]) => [...fs].sort((a, b) => (b.c.init ?? -99) - (a.c.init ?? -99))

  const rollInit = () => setDoc('encounter', (e) => log({
    ...e,
    combatants: e.combatants.map((c) => ({ ...c, init: c.init ?? roll('1d20').total + (fighters.find((f) => f.c.id === c.id)?.initMod ?? c.initMod) })),
  }, 'info', 'Initiative rolled.'))

  const card = (f: Fighter) => (
    <FighterCard key={f.c.id} f={f} label={f.ch ? label(f.ch) : f.name} turn={enc.turnId === f.c.id} picked={picked === f.c.id}
      dropping={drag.over === f.c.id} handlers={drag.bind(f.c.id)} dm={dm}
      onRemove={() => setDoc('encounter', (e) => ({ ...e, combatants: e.combatants.filter((x) => x.id !== f.c.id), turnId: e.turnId === f.c.id ? null : e.turnId }))}
      onLoot={() => setLootFor({ id: f.c.id })} />
  )
  const lastLog = enc.log[enc.log.length - 1]
  const seenLog = useRef(lastLog?.id)
  useEffect(() => {
    if (!lastLog || lastLog.id === seenLog.current) return
    seenLog.current = lastLog.id
    if (lastLog.kind === 'crit') flash('crit')
    if (lastLog.kind === 'down') flash('down')
  }, [lastLog])
  return (
    <div className="stack">
      {!dm && role.table && <div className="banner">👁 Live view of the battle — your DM runs combat. Damage they deal updates your sheet's HP.</div>}
      <div className="row between">
        <div className="row"><h2>Round {enc.round}</h2>{enc.turnId && <span className="pill">{byId(enc.turnId)?.name}'s turn</span>}</div>
        {dm && <div className="row">
          <button className="btn small" onClick={rollInit}>🎲 Initiative</button>
          <button className="btn small primary" onClick={nextTurn}>Next turn ▸</button>
          <button className="btn small ghost" onClick={async () => { if (await confirmBox('End combat? Initiative resets and fight-long effects end.', 'End combat')) endCombat() }}>End</button>
        </div>}
      </div>
      {dm && <p className="muted" style={{ fontSize: '.85rem' }}>{picked ? `Tap a target for ${byId(picked)?.name}…` : 'Drag an attacker onto a target to attack. Tap a card for HP and conditions.'}</p>}
      <div className="battle">
        <section>
          <div className="col-head"><span>Party</span>{dm && <button className="btn small" onClick={() => setAdding('party')}>＋</button>}</div>
          <div className="stack">{party.length ? sortedBy(party).map(card) : <Empty>No one yet.</Empty>}</div>
        </section>
        <section>
          <div className="col-head"><span>Monsters</span>{dm && <button className="btn small" onClick={() => setAdding('monster')}>＋</button>}</div>
          {dm && monsters.length > 0 && <button className="btn small ghost block" style={{ marginBottom: 8 }} onClick={async () => { if (await confirmBox('Clear all monsters from this fight?', 'Clear all', true)) setDoc('encounter', (e) => ({ ...e, combatants: e.combatants.filter((c) => c.side === 'party') })) }}>Clear all monsters</button>}
          <div className="stack">{monsters.length ? sortedBy(monsters).map(card) : <Empty>No monsters.</Empty>}</div>
        </section>
      </div>
      <div className="card stack">
        <div className="row between"><h3>Battle log</h3>{dm && enc.log.length > 0 && <button className="btn small ghost" onClick={() => setDoc('encounter', (e) => ({ ...e, log: [] }))}>Clear</button>}</div>
        <div className="log">{enc.log.length ? [...enc.log].reverse().map((l) => <div key={l.id} className={l.kind}>{l.text}</div>) : <span className="muted">Nothing yet.</span>}</div>
      </div>
      {dm && (
        <div className="card stack">
          <div className="label">Quick rarity rolls (DM)</div>
          <div className="rarity-row">{TIERS.map((t) => <button key={t} className="btn small" style={{ borderColor: TIER_COLOR[t], color: TIER_COLOR[t] }} onClick={() => setLootFor({ tier: t })}>{TIER_LABEL[t]}</button>)}</div>
        </div>
      )}
      {drag.ghost && <div className="ghost-card" style={{ left: drag.ghost.x, top: drag.ghost.y }}>⚔ {byId(drag.ghost.id)?.name}</div>}
      {attack && byId(attack.a) && byId(attack.t) && <AttackSheet att={byId(attack.a)!} tgt={byId(attack.t)!} onClose={() => setAttack(null)} />}
      {hpFor && byId(hpFor) && <HpSheet f={byId(hpFor)!} dm={dm} onClose={() => setHpFor(null)} onAttack={() => { setPicked(hpFor); setHpFor(null) }} onLoot={() => { setLootFor({ id: hpFor }); setHpFor(null) }} />}
      {adding && <AddSheet side={adding} onClose={() => setAdding(null)} />}
      {lootFor && <LootSheet target={lootFor} onClose={() => setLootFor(null)} />}
    </div>
  )
}

// ---------- drag to attack (mouse + touch, pointer events) ----------
function useDrag(enabled: boolean, onDrop: (a: string, t: string) => void, onTap: (id: string) => void) {
  const st = useRef<{ id: string; x: number; y: number; moved: boolean; pid: number } | null>(null)
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-cid]') as HTMLElement | null)?.dataset.cid ?? null
  return {
    ghost, over,
    bind: (id: string) => ({
      'data-cid': id,
      onPointerDown: (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return
        st.current = { id, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId }
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* old browser */ }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const d = st.current
        if (!d || !enabled) return
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) d.moved = true
        if (d.moved) { setGhost({ id: d.id, x: e.clientX, y: e.clientY }); const t = targetAt(e.clientX, e.clientY); setOver(t && t !== d.id ? t : null) }
      },
      onPointerUp: (e: React.PointerEvent) => {
        const d = st.current
        st.current = null; setGhost(null); setOver(null)
        if (!d) return
        if (!d.moved) { onTap(d.id); return }
        const t = targetAt(e.clientX, e.clientY)
        if (t && t !== d.id) onDrop(d.id, t)
      },
      onPointerCancel: () => { st.current = null; setGhost(null); setOver(null) },
    }),
  }
}

function Avatar({ f }: { f: { name: string; portrait?: string } }) {
  return <div className="avatar">{f.portrait ? <img src={f.portrait} alt="" width={34} height={34} style={{ objectFit: 'cover' }} /> : f.name.slice(0, 1)}</div>
}

/** Floating numbers and a shake whenever HP changes — on every phone watching. */
function useHpFx(hp: number) {
  const prev = useRef(hp)
  const [fx, setFx] = useState<{ id: number; n: number }[]>([])
  const [cls, setCls] = useState('')
  useEffect(() => {
    const d = hp - prev.current
    prev.current = hp
    if (!d) return
    const id = Date.now() + Math.random()
    setFx((x) => [...x.slice(-3), { id, n: d }])
    setCls(d < 0 ? 'hit' : 'healed')
    const a = setTimeout(() => setCls(''), 600)
    const b = setTimeout(() => setFx((x) => x.filter((y) => y.id !== id)), 1400)
    return () => { clearTimeout(a); void b }
  }, [hp])
  return { fx, cls }
}

function FighterCard({ f, label, turn, picked, dropping, handlers, dm, onRemove, onLoot }: { f: Fighter; label: string; turn: boolean; picked: boolean; dropping: boolean; handlers: Record<string, unknown>; dm: boolean; onRemove: () => void; onLoot: () => void }) {
  const { fx, cls } = useHpFx(f.hp)
  return (
    <div className={`fighter ${turn ? 'turn' : ''} ${f.hp <= 0 ? 'down' : ''} ${picked ? 'picked' : ''} ${dropping ? 'drop' : ''} ${cls}`} {...handlers}>
      {fx.map((x) => <span key={x.id} className={`floater ${x.n < 0 ? (x.n <= -Math.max(10, f.maxHp * .4) ? 'dmg crit' : 'dmg') : 'heal'}`}>{x.n < 0 ? x.n : `+${x.n}`}</span>)}
      <div className="row nowrap">
        <Avatar f={f} />
        <div className="grow"><div className="fname">{label}</div>
          <div className="stats"><span className="ac" title="Armor Class">{f.ac}</span>{f.c.init != null && <span>Init {f.c.init}</span>}{f.c.side === 'monster' && f.c.lootTier && <span className="tag" style={{ color: TIER_COLOR[f.c.lootTier], borderColor: TIER_COLOR[f.c.lootTier] }}>{TIER_LABEL[f.c.lootTier]}</span>}</div>
        </div>
      </div>
      <HpBar hp={f.hp} max={f.maxHp} temp={f.temp} />
      {f.conditions.length > 0 && <div className="row">{f.conditions.map((c) => <span key={c} className="pill warn">{c}</span>)}</div>}
      {dm && f.c.side === 'monster' && (
        <div className="row">
          <button className="btn small" onClick={onLoot}>💎 Roll loot</button>
          <button className="btn small danger" onClick={onRemove}>Remove</button>
        </div>
      )}
    </div>
  )
}

// ---------- attack ----------
type Mode = 'weapon' | 'spell' | 'scroll' | 'heal'
function AttackSheet({ att, tgt, onClose }: { att: Fighter; tgt: Fighter; onClose: () => void }) {
  const s = useApp()
  const quick = s.local.quickAttack
  const ch = att.ch
  const scrolls = ch ? ch.inventory.filter((i) => i.kind === 'scroll' && i.spellId) : []
  const known = ch?.caster ? ch.caster.known.map((id) => spellById(id, ch.caster!.custom)).filter((x) => x && (x.damage || x.heal)) : []
  const [mode, setMode] = useState<Mode>('weapon')
  const [atkId, setAtkId] = useState(att.attacks[0]?.id ?? 'custom')
  const [custom, setCustom] = useState<Attack>({ id: 'custom', name: 'Attack', toHit: 0, damage: '1d6', damageType: 'slashing' })
  const [adv, setAdv] = useState<'adv' | 'dis' | 'none'>('none')
  const [manual, setManual] = useState(false)
  const [d20, setD20] = useState(10)
  const [dmgTyped, setDmgTyped] = useState(5)
  const [rider, setRider] = useState<{ dice: string; type: DamageType } | null>(null)
  const [spellId, setSpellId] = useState(known[0]?.id ?? '')
  const [slot, setSlot] = useState(1)
  const [scrollId, setScrollId] = useState(scrolls[0]?.id ?? '')
  const [saved, setSaved] = useState(false)
  const [result, setResult] = useState<AttackResult | null>(null)
  const [healAmt, setHealAmt] = useState(5)

  // what is being thrown?
  const spellItem = mode === 'scroll' ? ch?.inventory.find((i) => i.id === scrollId) : undefined
  const spell = mode === 'spell' ? spellById(spellId, ch?.caster?.custom) : mode === 'scroll' && spellItem?.spellId ? spellById(spellItem.spellId) : undefined
  const castLevel = mode === 'scroll' ? spell?.level ?? 1 : Math.max(spell?.level ?? 1, slot)
  const castMod = ch?.caster ? amod(ch, ch.caster.ability) : ch ? Math.max(amod(ch, 'int'), amod(ch, 'wis'), amod(ch, 'cha')) : 0
  const upDice = (base: string, up?: string) => (up && spell && castLevel > spell.level ? `${base}+${Array(castLevel - spell.level).fill(up).join('+')}` : base)
  const weapon: Attack = atkId === 'custom' ? custom : att.attacks.find((a) => a.id === atkId) ?? custom
  const current: Attack | null = mode === 'weapon' ? { ...weapon, ...(rider ? { bonusDice: rider.dice, bonusType: rider.type } : {}) }
    : spell?.damage ? { id: 'spell', name: spell.name, toHit: ch ? (ch.caster ? spellAttack(ch) : prof(ch) + castMod) : 0, damage: upDice(spell.damage, spell.upcast), damageType: spell.damageType ?? 'force' } : null
  const isSave = !!spell?.save && !spell.attack
  const healing = mode === 'heal' || (!!spell?.heal && !spell.damage)
  const slotsLeft = (lvl: number) => (ch?.caster ? ch.caster.max[lvl - 1] - ch.caster.used[lvl - 1] : 0)
  const forceCrit = mode === 'weapon' && !!ch?.inventory.find((i) => i.id === weapon.itemId)?.coating?.crit
  const weaponBroken = !!ch && !!weapon.itemId && !ch.inventory.some((i) => i.id === weapon.itemId)

  const spend = (): boolean => {
    if (!ch) return true
    if (mode === 'spell' && spell && spell.level > 0) {
      if (slotsLeft(castLevel) <= 0) { toast('No slot of that level left!', 'bad'); return false }
      patch('chars', ch.id, (c) => ({ ...c, caster: { ...c.caster!, used: c.caster!.used.map((u, i) => (i === castLevel - 1 ? u + 1 : u)) } }))
    }
    if (mode === 'scroll' && spellItem) patch('chars', ch.id, (c) => removeItem(c, spellItem.id, 1))
    return true
  }
  const doRoll = () => {
    if (healing) {
      if (!spend()) return
      const amt = mode === 'heal' ? healAmt : Math.max(0, roll(upDice(spell!.heal!, spell!.upcast)).total + (/^\d+$/.test(spell!.heal!) ? 0 : castMod))
      changeHp(tgt, -amt)
      addLog('heal', `${att.name} heals ${tgt.name} for ${amt}${spell ? ` (${spell.name})` : ''}.`)
      toast(`${tgt.name} +${amt} HP`, 'good')
      onClose()
      return
    }
    if (!current) return
    const r = resolveAttack({
      toHit: current.toHit, damage: current.damage, damageType: current.damageType, bonusDice: current.bonusDice, bonusType: current.bonusType,
      beast: !!att.c.beast, adv: adv === 'none' ? null : adv, d20: manual && !isSave ? d20 : undefined, damageOverride: manual ? dmgTyped : undefined,
      autoHit: isSave, halfDamage: isSave && saved, forceCrit,
    }, defenderOf(tgt))
    if (!spend()) return
    if (quick) { applyAttack(att, tgt, current, r); toast(r.hit ? `${r.crit ? 'CRIT! ' : 'Hit: '}${r.damage} damage` : 'Miss', r.hit ? 'good' : undefined); onClose() } else setResult(r)
  }
  const canShrug = result?.hit && tgt.ch && !tgt.ch.shrugUsed && (() => { const a = defenderOf(tgt).armor; return a && (a.shrug === 'any' || a.shrug === current?.damageType) })()

  return (
    <Sheet title={<>⚔ {att.name} → {tgt.name}</>} onClose={onClose}>
      <div className="row between">
        <Seg value={mode} onChange={(m) => { setMode(m); setResult(null) }} options={[{ id: 'weapon', label: 'Attack' }, ...(known.length ? [{ id: 'spell' as Mode, label: 'Spell' }] : []), ...(scrolls.length ? [{ id: 'scroll' as Mode, label: 'Scroll' }] : []), { id: 'heal', label: 'Heal' }]} />
        <label className="toggle"><input type="checkbox" checked={quick} onChange={(e) => setLocal((l) => ({ ...l, quickAttack: e.target.checked }))} /> Quick</label>
      </div>
      {mode === 'weapon' && (
        <>
          <div className="row">{att.attacks.map((a) => <button key={a.id} className={`chip ${a.id === atkId ? 'on' : ''}`} onClick={() => setAtkId(a.id)}>{a.name} {fmtMod(a.toHit)} · {a.damage} {DAMAGE_ICON[a.damageType]}</button>)}<button className={`chip ${atkId === 'custom' ? 'on' : ''}`} onClick={() => setAtkId('custom')}>Other…</button></div>
          {atkId === 'custom' && (
            <div className="grid2">
              <Field label="To hit"><Stepper value={custom.toHit} onChange={(n) => setCustom({ ...custom, toHit: n })} /></Field>
              <Field label="Damage dice"><input value={custom.damage} onChange={(e) => setCustom({ ...custom, damage: e.target.value })} /></Field>
              <Field label="Damage type"><select value={custom.damageType} onChange={(e) => setCustom({ ...custom, damageType: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            </div>
          )}
          {!quick && (
            <div className="row">
              <span className="label">Bonus rider</span>
              {rider ? <><input style={{ width: 80 }} value={rider.dice} onChange={(e) => setRider({ ...rider, dice: e.target.value })} /><select style={{ width: 130 }} value={rider.type} onChange={(e) => setRider({ ...rider, type: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select><button className="btn small ghost" onClick={() => setRider(null)}>✕</button></>
                : <button className="btn small" onClick={() => setRider({ dice: '1d4', type: 'fire' })}>＋ e.g. 1d4 fire</button>}
            </div>
          )}
          {forceCrit && <div className="pill good">Whetstone Oil: this hit is a crit</div>}
          {weaponBroken && <div className="pill bad">That weapon is gone</div>}
        </>
      )}
      {mode === 'spell' && ch?.caster && (
        <>
          <select value={spellId} onChange={(e) => setSpellId(e.target.value)}>{known.map((sp) => <option key={sp!.id} value={sp!.id}>{sp!.level ? `L${sp!.level}` : 'Cantrip'} · {sp!.name}</option>)}</select>
          {spell && spell.level > 0 && <div className="row"><span className="label">Slot</span>{[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((l) => l >= spell.level && ch.caster!.max[l - 1] > 0).map((l) => <button key={l} className={`chip ${castLevel === l ? 'on' : ''}`} onClick={() => setSlot(l)}>L{l} ({slotsLeft(l)} left)</button>)}</div>}
          {spell && <p className="muted" style={{ fontSize: '.88rem' }}>{spell.desc}{isSave && ch ? ` Save DC ${spellDC(ch)}.` : ''}</p>}
        </>
      )}
      {mode === 'scroll' && (
        <>
          <select value={scrollId} onChange={(e) => setScrollId(e.target.value)}>{scrolls.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</select>
          <p className="muted" style={{ fontSize: '.88rem' }}>House rule: anyone can read a scroll from their pack. No slot needed — the scroll is used up.</p>
        </>
      )}
      {mode === 'heal' && <Field label="Heal amount"><Stepper value={healAmt} min={0} onChange={setHealAmt} /></Field>}
      {!healing && (
        <>
          {isSave ? <label className="toggle"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> {tgt.name} made the {spell?.save?.toUpperCase()} save (half damage)</label>
            : <Seg value={adv} onChange={setAdv} options={[{ id: 'none', label: 'Normal' }, { id: 'adv', label: 'Advantage' }, { id: 'dis', label: 'Disadvantage' }]} />}
          <label className="toggle"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Rolled at the table (type the numbers)</label>
          {manual && <div className="row">{!isSave && <Field label="d20 roll"><Stepper value={d20} min={1} max={20} onChange={setD20} /></Field>}<Field label="Damage rolled"><Stepper value={dmgTyped} min={0} onChange={setDmgTyped} /></Field></div>}
          <p className="muted" style={{ fontSize: '.85rem' }}>Target AC {defenderOf(tgt).acFor(current?.damageType ?? 'slashing', !!att.c.beast)} vs {current?.damageType}. Final damage is after armor, resistance and vulnerability (min 0).</p>
        </>
      )}
      {result && current && (
        <div className="card stack">
          <div className="callout" style={{ color: result.hit ? (result.crit ? 'var(--accent)' : 'var(--good)') : 'var(--muted)' }}>{result.hit ? (result.crit ? 'CRITICAL HIT' : 'HIT') : 'MISS'}</div>
          <p>{result.log}</p>
          {result.wear && tgt.ch && <p className="muted">Armor wear: −{result.wear.amount} ({result.wear.reason})</p>}
          {!result.hit && att.ch && current.itemId && <p className="muted">Weapon wear on a miss: −{result.weaponWear}</p>}
          <div className="row end">
            {canShrug && <button className="btn" onClick={() => { applyAttack(att, tgt, current, result, { shrug: true }); onClose() }}>Shrug it off (1/day)</button>}
            <button className="btn ghost" onClick={() => setResult(null)}>Reroll</button>
            <button className="btn primary" onClick={() => { applyAttack(att, tgt, current, result); onClose() }}>Apply</button>
          </div>
        </div>
      )}
      {!result && <button className="btn primary block" onClick={doRoll} disabled={mode === 'weapon' && weaponBroken}>{healing ? '✚ Heal' : quick ? '🎲 Roll & apply' : '🎲 Roll'}</button>}
    </Sheet>
  )
}

// ---------- HP, conditions, edit ----------
function HpSheet({ f, dm, onClose, onAttack, onLoot }: { f: Fighter; dm: boolean; onClose: () => void; onAttack: () => void; onLoot: () => void }) {
  const [n, setN] = useState(5)
  const [edit, setEdit] = useState(false)
  const setCond = (c: Condition) => {
    const has = f.conditions.includes(c)
    const next = has ? f.conditions.filter((x) => x !== c) : [...f.conditions, c]
    if (f.ch) patch('chars', f.ch.id, (ch) => ({ ...ch, conditions: next }))
    else setDoc('encounter', (e) => ({ ...e, combatants: e.combatants.map((x) => (x.id === f.c.id ? { ...x, conditions: next } : x)) }))
  }
  const setInit = (v: number | null) => setDoc('encounter', (e) => ({ ...e, combatants: e.combatants.map((x) => (x.id === f.c.id ? { ...x, init: v } : x)) }))
  return (
    <Sheet title={f.name} onClose={onClose}>
      <HpBar hp={f.hp} max={f.maxHp} temp={f.temp} />
      {dm ? (
        <>
          <div className="row"><Stepper value={n} min={0} onChange={setN} label="Amount" />
            <button className="btn danger" onClick={() => { changeHp(f, n); addLog('hit', `${f.name} takes ${n} damage.`) }}>− Damage</button>
            <button className="btn" style={{ borderColor: 'var(--good)', color: 'var(--good)' }} onClick={() => { changeHp(f, -n); addLog('heal', `${f.name} heals ${n}.`) }}>＋ Heal</button>
          </div>
          <div className="row">
            <button className="btn small" onClick={() => changeHp(f, 0, { temp: n })}>Set temp HP to {n}</button>
            <button className="btn small" onClick={() => changeHp(f, 0, { full: true })}>Full HP</button>
            <Field label="Initiative"><Stepper value={f.c.init ?? 0} onChange={(v) => setInit(v)} /></Field>
          </div>
          <div className="row"><button className="btn primary" onClick={onAttack}>⚔ Attack… then tap a target</button>{f.c.side === 'monster' && <button className="btn" onClick={onLoot}>💎 Roll loot</button>}</div>
        </>
      ) : <p className="muted">AC {f.ac} · {f.attacks.map((a) => a.name).join(', ') || 'no attacks'}</p>}
      <div className="label">Conditions</div>
      <div className="row">{CONDITIONS.map((c) => <button key={c} disabled={!dm} className={`chip ${f.conditions.includes(c) ? 'on' : ''}`} onClick={() => setCond(c)}>{c}</button>)}</div>
      {f.c.side === 'monster' && dm && (edit ? <MonsterEditor c={f.c} onDone={() => setEdit(false)} /> : <button className="btn" onClick={() => setEdit(true)}>✎ Edit monster (traits, loot tier, gear)</button>)}
    </Sheet>
  )
}

function MonsterEditor({ c, onDone }: { c: Combatant; onDone: () => void }) {
  const [m, setM] = useState<Combatant>(c)
  const inferred = inferLoadout({ attacks: m.attacks, armorText: m.armorText })
  const save = () => { setDoc('encounter', (e) => ({ ...e, combatants: e.combatants.map((x) => (x.id === c.id ? m : x)) })); onDone() }
  const setAtk = (i: number, p: Partial<Attack>) => setM({ ...m, attacks: m.attacks.map((a, j) => (j === i ? { ...a, ...p } : a)) })
  return (
    <div className="card stack">
      <div className="grid2">
        <Field label="Name"><input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} /></Field>
        <div className="row"><Field label="AC"><Stepper value={m.ac} min={0} onChange={(n) => setM({ ...m, ac: n })} /></Field><Field label="Max HP"><Stepper value={m.maxHp} min={1} onChange={(n) => setM({ ...m, maxHp: n, hp: Math.min(m.hp, n) })} /></Field></div>
        <Field label="Armor line" hint="Used to guess dropped armor"><input value={m.armorText ?? ''} onChange={(e) => setM({ ...m, armorText: e.target.value })} /></Field>
        <label className="toggle"><input type="checkbox" checked={!!m.beast} onChange={(e) => setM({ ...m, beast: e.target.checked })} /> Beast (hide armor bonuses apply)</label>
      </div>
      <div className="label">Attacks</div>
      {m.attacks.map((a, i) => (
        <div key={a.id} className="row">
          <input style={{ flex: '2 1 120px' }} value={a.name} onChange={(e) => setAtk(i, { name: e.target.value })} />
          <Stepper value={a.toHit} onChange={(n) => setAtk(i, { toHit: n })} />
          <input style={{ flex: '1 1 70px' }} value={a.damage} onChange={(e) => setAtk(i, { damage: e.target.value })} />
          <select style={{ flex: '1 1 110px' }} value={a.damageType} onChange={(e) => setAtk(i, { damageType: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <button className="btn small ghost" onClick={() => setM({ ...m, attacks: m.attacks.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => setM({ ...m, attacks: [...m.attacks, { id: uid(), name: 'Claw', toHit: 3, damage: '1d6+1', damageType: 'slashing' }] })}>＋ Attack</button>
      <div className="label">Homebrew traits</div>
      <TraitEditor traits={m.traits} onChange={(traits) => setM({ ...m, traits })} />
      <div className="label">Loot</div>
      <div className="grid2">
        <Field label="Loot tier"><select value={m.lootTier ?? ''} onChange={(e) => setM({ ...m, lootTier: (e.target.value || undefined) as Tier | undefined })}><option value="">Guess from name ({TIER_LABEL[guessTier(m.name)]})</option>{TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select></Field>
        <Field label="Held weapon"><select value={m.lootWeaponId ?? ''} onChange={(e) => setM({ ...m, lootWeaponId: e.target.value || undefined })}><option value="">Infer from attacks{inferred.weaponId ? ` (${inferred.weaponId})` : ''}</option>{WEAPONS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
        <Field label="Armor"><select value={m.lootArmorId ?? ''} onChange={(e) => setM({ ...m, lootArmorId: e.target.value || undefined })}><option value="">Infer from the armor line{inferred.armorId ? ` (${inferred.armorId})` : ' (light split)'}</option>{ARMOR.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      </div>
      <div className="row end"><button className="btn ghost" onClick={onDone}>Cancel</button><button className="btn primary" onClick={save}>Save</button></div>
    </div>
  )
}

export function TraitEditor({ traits, onChange }: { traits: Combatant['traits']; onChange: (t: Combatant['traits']) => void }) {
  const [effect, setEffect] = useState<TraitEffect>('resistance')
  const [type, setType] = useState<DamageType>('fire')
  const [text, setText] = useState('')
  return (
    <div className="stack">
      <div className="row">{traits.map((t) => <span key={t.id} className="pill">{t.effect === 'custom' ? t.text || t.name : `${t.effect}: ${(t.types ?? []).join(', ')}`}<button className="icon-btn" style={{ width: 20, height: 20, fontSize: '.7rem' }} onClick={() => onChange(traits.filter((x) => x.id !== t.id))}>✕</button></span>)}{!traits.length && <span className="muted">None</span>}</div>
      <div className="row">
        <select style={{ width: 150 }} value={effect} onChange={(e) => setEffect(e.target.value as TraitEffect)}>{['resistance', 'vulnerability', 'immunity', 'advantage', 'disadvantage', 'custom'].map((x) => <option key={x}>{x}</option>)}</select>
        {effect === 'custom' || effect === 'advantage' || effect === 'disadvantage' ? <input style={{ flex: 1, minWidth: 120 }} placeholder="e.g. on saves vs fear" value={text} onChange={(e) => setText(e.target.value)} />
          : <select style={{ width: 140 }} value={type} onChange={(e) => setType(e.target.value as DamageType)}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}
        <button className="btn small" onClick={() => { onChange([...traits, { id: uid(), name: effect, effect, types: ['resistance', 'vulnerability', 'immunity'].includes(effect) ? [type] : undefined, text: text || undefined }]); setText('') }}>Add</button>
      </div>
    </div>
  )
}

// ---------- add party / monsters ----------
function AddSheet({ side, onClose }: { side: 'party' | 'monster'; onClose: () => void }) {
  const s = useApp()
  const label = usePlayerLabel()
  const [q, setQ] = useState('')
  const [count, setCount] = useState(1)
  const inFight = new Set(s.docs.encounter.combatants.map((c) => c.characterId).filter(Boolean))
  const addChar = (c: Character) => setDoc('encounter', (e) => ({ ...e, combatants: [...e.combatants, { id: uid(), side: 'party', characterId: c.id, name: c.name, init: null, initMod: amod(c, 'dex'), ac: 10, maxHp: 1, hp: 1, tempHp: 0, attacks: [], traits: [], conditions: [] }] }))
  const addMonster = (key: string | null) => {
    const m = key ? MONSTERS.find((x) => x.key === key)! : null
    const existing = s.docs.encounter.combatants.filter((c) => c.side === 'monster' && (m ? c.srdKey === key : false)).length
    const made: Combatant[] = Array.from({ length: count }, (_, i) => {
      const hp = m ? average(m.hp) : 10
      const n = existing + i + 1
      return {
        id: uid(), side: 'monster', name: m ? (count > 1 || existing ? `${m.name} ${n}` : m.name) : (q.trim() || 'Monster'), init: null, initMod: m?.dex ?? 0,
        ac: m?.ac ?? 12, maxHp: hp, hp, tempHp: 0, conditions: [], armorText: m?.armor, srdKey: key ?? undefined, beast: m?.beast,
        attacks: m ? m.attacks.map(([name, toHit, damage, damageType]) => ({ id: uid(), name, toHit, damage, damageType })) : [{ id: uid(), name: 'Attack', toHit: 3, damage: '1d6+1', damageType: 'slashing' }],
        traits: (m?.traits ?? []).map(([effect, types]) => ({ id: uid(), name: effect, effect, types })),
      }
    })
    setDoc('encounter', (e) => ({ ...e, combatants: [...e.combatants, ...made] }))
    toast(`Added ${made.length} ${m?.name ?? 'monster'}${made.length > 1 ? 's' : ''}`)
  }
  if (side === 'party') {
    const chars = list('chars').filter((c) => !inFight.has(c.id))
    return (
      <Sheet title="Add to the party" onClose={onClose}>
        {chars.length ? chars.map((c) => <button key={c.id} className="btn block" onClick={() => { addChar(c); onClose() }}>{label(c)} · L{c.level} {c.cls}</button>) : <Empty>Everyone's already in the fight. Make characters on the Characters tab.</Empty>}
        {chars.length > 1 && <button className="btn primary" onClick={() => { chars.forEach(addChar); onClose() }}>Add everyone</button>}
      </Sheet>
    )
  }
  const found = MONSTERS.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet title="Add monsters" onClose={onClose}>
      <div className="row"><input id="monster-search" placeholder="Search the SRD or type a custom name" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} /><Stepper value={count} min={1} max={20} onChange={setCount} label="How many" /></div>
      {q.trim() && <button className="btn" onClick={() => addMonster(null)}>＋ Custom “{q.trim()}” (edit stats after)</button>}
      <div className="stack">{found.map((m) => (
        <button key={m.key} className="item" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => addMonster(m.key)}>
          <div className="meta"><div className="name">{m.name}</div><div className="sub">CR {m.cr} · AC {m.ac} · HP {average(m.hp)} · {m.attacks.map((a) => a[0]).join(', ')}</div></div>
          <RarityTag it={{ tier: guessTier(m.name) }} />
        </button>
      ))}</div>
    </Sheet>
  )
}

// ---------- loot ----------
function LootSheet({ target, onClose }: { target: { id?: string; tier?: Tier }; onClose: () => void }) {
  const s = useApp()
  const label = usePlayerLabel()
  const mon = target.id ? s.docs.encounter.combatants.find((c) => c.id === target.id) : undefined
  const [tier, setTier] = useState<Tier>(target.tier ?? mon?.lootTier ?? guessTier(mon?.name ?? ''))
  const [items, setItems] = useState<Item[] | null>(null)
  const go = () => {
    const out = rollLoot(tier, inferLoadout(mon ?? {}))
    setItems(out)
    addLog('info', `Loot roll (${TIER_LABEL[tier]}${mon ? `, ${mon.name}` : ''}): ${out.length ? out.map((i) => i.name).join(', ') : 'nothing dropped'}`)
  }
  const give = (it: Item, c: Character) => { patch('chars', c.id, (x) => addItem(x, it)); setItems((xs) => xs!.filter((x) => x.id !== it.id)); toast(`${it.name} → ${c.name}`, 'good') }
  const toChest = (it: Item) => { setDoc('encounter', (e) => ({ ...e, pendingLoot: [...e.pendingLoot, it] })); setItems((xs) => xs!.filter((x) => x.id !== it.id)); toast('Sent to Loot → Battle drops') }
  return (
    <Sheet title={mon ? `Loot: ${mon.name}` : 'Quick rarity roll'} onClose={onClose}>
      <div className="rarity-row">{TIERS.map((t) => <button key={t} className={`btn small ${t === tier ? 'primary' : ''}`} style={t === tier ? {} : { borderColor: TIER_COLOR[t], color: TIER_COLOR[t] }} onClick={() => { setTier(t); setItems(null) }}>{TIER_LABEL[t]}</button>)}</div>
      <button className="btn primary" onClick={go}>🎲 Roll {TIER_LABEL[tier]} loot</button>
      {items && (items.length === 0 ? <Empty>Nothing dropped.</Empty> : items.map((it) => (
        <div key={it.id} className="card stack">
          <div className="row nowrap"><ItemArt it={it} size={44} /><div className="grow"><b>{it.name}</b><div><RarityTag it={it} /></div></div></div>
          <div className="row">{list('chars').map((c) => <button key={c.id} className="btn small" onClick={() => give(it, c)}>→ {label(c)}</button>)}<button className="btn small primary" onClick={() => toChest(it)}>Into chest</button></div>
        </div>
      )))}
    </Sheet>
  )
}
