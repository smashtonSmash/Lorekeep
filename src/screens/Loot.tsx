import { useRef, useState } from 'react'
import { del, getState, list, patch, put, setDoc, useApp } from '../core/store'
import { usePlayerLabel, useRole } from '../core/role'
import type { Chest, Item } from '../core/types'
import { uid } from '../core/types'
import { addItem, receive } from '../rules/character'
import { splitCoins } from '../rules/loot'
import { ItemArt } from '../ui/art'
import { GiveItemSheet } from '../ui/Inventory'
import { Empty, Field, RarityTag, Stepper, confirmBox, toast } from '../ui/kit'

/** A player takes a revealed item (server-free version of take_loot: first write wins on the chest). */
export function takeFromChest(chestId: string, itemId: string, charId: string, who: string) {
  const k = getState().cols.chests[chestId]
  const it = k?.items.find((i) => i.id === itemId)
  if (!k || !it || k.takenBy[itemId]) return
  put('chests', { ...k, items: k.items.filter((i) => i.id !== itemId), takenBy: { ...k.takenBy, [itemId]: who } })
  patch('chars', charId, (c) => addItem(c, it))
  addRecap('💎', `${who} took ${it.name} from ${k.name}`)
}
export function addRecap(icon: string, text: string) {
  setDoc('recap', (r) => ({ events: [...r.events.slice(-199), { id: uid(), t: Date.now(), icon, text }] }))
}

export default function Loot() {
  const s = useApp()
  const role = useRole()
  const chests = list('chests').filter((k) => !k.closed).sort((a, b) => b.createdAt - a.createdAt)
  const pending = s.docs.encounter.pendingLoot
  if (!role.isDM) {
    const shown = chests.filter((k) => k.revealedAt)
    return (
      <div className="stack">
        <h2>Loot</h2>
        {shown.length ? shown.map((k) => <ChestCard key={k.id} k={k} dm={false} />) : <Empty>No treasure on the table. When the DM reveals a chest, it pops up here.</Empty>}
      </div>
    )
  }
  const newChest = (items: Item[] = []) => put('chests', { id: uid(), name: `Chest ${list('chests').length + 1}`, items, gold: 0, silver: 0, pouches: [], takenBy: {}, createdAt: Date.now() })
  return (
    <div className="stack">
      <div className="row between"><h2>Loot</h2><button className="btn primary" onClick={() => newChest()}>＋ Chest</button></div>
      {pending.length > 0 && (
        <div className="card stack" style={{ borderColor: 'var(--accent)' }}>
          <div className="row between"><h3>Battle drops</h3><div className="row"><button className="btn small primary" onClick={() => { newChest(pending); setDoc('encounter', (e) => ({ ...e, pendingLoot: [] })) }}>Put all in a new chest</button><button className="btn small ghost" onClick={() => setDoc('encounter', (e) => ({ ...e, pendingLoot: [] }))}>Discard</button></div></div>
          {pending.map((it) => <div key={it.id} className="item"><ItemArt it={it} size={36} /><div className="meta"><div className="name">{it.name}</div><RarityTag it={it} /></div></div>)}
        </div>
      )}
      {chests.length ? chests.map((k) => <ChestCard key={k.id} k={k} dm />) : <Empty>No open chests. Make one, or roll loot in Battle.</Empty>}
    </div>
  )
}

function ChestArt({ open, color }: { open: boolean; color: string }) {
  return (
    <svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">
      <rect x="6" y="22" width="52" height="26" rx="3" fill="#7a4f27" stroke="#3a2412" strokeWidth="2" />
      {open ? <path d="M6 22 L12 4 H52 L58 22z" fill="#5f3c1c" stroke="#3a2412" strokeWidth="2" /> : <path d="M6 22 Q32 2 58 22z" fill="#8a5a2b" stroke="#3a2412" strokeWidth="2" />}
      <rect x="6" y="28" width="52" height="4" fill={color} />
      <rect x="28" y="26" width="8" height="10" rx="1.5" fill="#f2c14e" stroke="#3a2412" />
      {open && <g fill="#f2c14e"><circle cx="22" cy="20" r="3" /><circle cx="30" cy="17" r="3" /><circle cx="40" cy="20" r="3" /></g>}
    </svg>
  )
}

function ChestCard({ k, dm }: { k: Chest; dm: boolean }) {
  const label = usePlayerLabel()
  const [adding, setAdding] = useState(false)
  const [g, setG] = useState(0)
  const [sv, setSv] = useState(0)
  const chars = list('chars')
  const drag = useRef<string | null>(null)
  const save = (patchK: Partial<Chest>) => put('chests', { ...k, ...patchK })
  const giveItem = (it: Item, charId: string) => {
    const c = chars.find((x) => x.id === charId)!
    patch('chars', charId, (x) => addItem(x, it))
    save({ items: k.items.filter((i) => i.id !== it.id), takenBy: { ...k.takenBy, [it.id]: label(c) } })
    addRecap('🎁', `${c.name} received ${it.name}`)
    toast(`${it.name} → ${c.name}`, 'good')
  }
  const giveCoins = (charId: string, silver: number) => patch('chars', charId, (x) => receive(x, silver))
  const total = k.gold * 10 + k.silver
  return (
    <div className="card stack">
      <div className="row nowrap">
        <ChestArt open={!!k.revealedAt} color={k.revealedAt ? 'var(--accent)' : '#5b636e'} />
        <div className="grow">
          {dm ? <input value={k.name} onChange={(e) => save({ name: e.target.value })} aria-label="Chest name" /> : <h3>{k.name}</h3>}
          <div className="muted num">🪙 {k.gold}g {k.silver}s{k.pouches.length ? ` · ${k.pouches.length} pouch${k.pouches.length > 1 ? 'es' : ''}` : ''}</div>
        </div>
      </div>
      {dm && (
        <div className="row">
          <button className={`btn small ${k.revealedAt ? '' : 'primary'}`} onClick={() => { save({ revealedAt: k.revealedAt ? undefined : Date.now() }); if (!k.revealedAt) addRecap('✨', `${k.name} was revealed`) }}>{k.revealedAt ? 'Hide from party' : '✨ Reveal to party'}</button>
          <label className="toggle"><input type="checkbox" checked={!!k.allowTake} onChange={(e) => save({ allowTake: e.target.checked })} /> Allow players to take</label>
          <button className="btn small" onClick={() => setAdding(true)}>＋ Item</button>
          <button className="btn small ghost" onClick={async () => { if (await confirmBox(`Close ${k.name}? Anything left inside is gone.`, 'Close chest')) { k.items.length || total ? save({ closed: true, revealedAt: undefined }) : del('chests', k.id) } }}>🔒 Close chest</button>
        </div>
      )}
      <div className="stack">
        {k.items.map((it) => (
          <div key={it.id} className="item" draggable={dm} onDragStart={() => { drag.current = it.id }}>
            <ItemArt it={it} size={40} />
            <div className="meta"><div className="name">{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}</div><RarityTag it={it} /></div>
            {dm && <select style={{ width: 'auto', maxWidth: 150 }} value="" onChange={(e) => e.target.value && giveItem(it, e.target.value)} aria-label="Give to"><option value="">Give to…</option>{chars.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}</select>}
            {dm && <button className="icon-btn" onClick={() => save({ items: k.items.filter((i) => i.id !== it.id) })} aria-label="Remove">✕</button>}
          </div>
        ))}
        {!k.items.length && <span className="muted">No items inside.</span>}
        {Object.entries(k.takenBy).length > 0 && <small>Taken: {Object.values(k.takenBy).join(', ')}</small>}
      </div>
      {dm && (
        <>
          <div className="row" onDragOver={(e) => e.preventDefault()}>
            {chars.map((c) => <button key={c.id} className="chip" onDragOver={(e) => e.preventDefault()} onDrop={() => { const it = k.items.find((i) => i.id === drag.current); if (it) giveItem(it, c.id) }}>⇢ {c.name}</button>)}
            <small className="muted">On a computer, drag items onto a name.</small>
          </div>
          <details>
            <summary>Coins & pouches</summary>
            <div className="stack" style={{ paddingTop: 8 }}>
              <div className="row"><Field label="Gold"><Stepper value={g} min={0} onChange={setG} /></Field><Field label="Silver"><Stepper value={sv} min={0} onChange={setSv} /></Field>
                <button className="btn small" onClick={() => save({ gold: k.gold + g, silver: k.silver + sv })}>Add to chest</button>
                <button className="btn small" disabled={!g && !sv} onClick={() => save({ pouches: [...k.pouches, { id: uid(), gold: g, silver: sv }] })}>👝 New pouch</button>
              </div>
              {k.pouches.map((p) => (
                <div key={p.id} className="row"><span>👝 {p.gold}g {p.silver}s</span>
                  <select style={{ width: 'auto' }} value="" onChange={(e) => { if (!e.target.value) return; giveCoins(e.target.value, p.gold * 10 + p.silver); save({ pouches: k.pouches.filter((x) => x.id !== p.id) }); toast('Pouch handed over') }}><option value="">Give pouch to…</option>{chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
              ))}
              {total > 0 && chars.length > 0 && (
                <div className="row">
                  <button className="btn small primary" onClick={() => { const r = splitCoins(k.gold, k.silver, chars.length); chars.forEach((c) => giveCoins(c.id, r.each)); save({ gold: Math.floor(r.leftover / 10), silver: r.leftover % 10 }); addRecap('⚖', `${k.name}: ${r.each / 10}g each to ${chars.length}`); toast(`Split evenly: ${Math.floor(r.each / 10)}g ${r.each % 10}s each${r.leftover ? `, ${r.leftover}s left in the chest` : ''}`) }}>⚖ Split evenly</button>
                  {chars.map((c) => <span key={c.id} className="row" style={{ gap: 4 }}><small>{c.name}:</small><button className="btn small" onClick={() => { const half = Math.floor(total / 2); giveCoins(c.id, half); save({ gold: Math.floor((total - half) / 10), silver: (total - half) % 10 }) }}>Half</button><button className="btn small" onClick={() => { giveCoins(c.id, total); save({ gold: 0, silver: 0 }) }}>Rest</button></span>)}
                </div>
              )}
            </div>
          </details>
        </>
      )}
      {adding && <GiveItemSheet onClose={() => setAdding(false)} onGive={(it) => { save({ items: [...getState().cols.chests[k.id].items, it] }); toast(`${it.name} added`) }} />}
    </div>
  )
}
