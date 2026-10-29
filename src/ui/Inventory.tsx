import { useState } from 'react'
import { roll } from '../core/dice'
import { del, list, patch, put, useApp } from '../core/store'
import { usePlayerLabel, useRole } from '../core/role'
import type { Character, DamageType, Item, ItemKind, Tier } from '../core/types'
import { DAMAGE_TYPES, TIERS, uid } from '../core/types'
import { SPELLS } from '../data/spells'
import { ARMOR, armorDef, canGoUnder } from '../rules/armor'
import {
  addItem, bodyArmor, coinLabel, encumbrance, fromSilver, pay, receive, removeItem, toggleEquip, underArmor, updateItem, wieldedShield,
} from '../rules/character'
import { acceptTrade } from '../rules/economy'
import {
  ACCESSORIES, CONSUMABLES, MATS, SHIELDS, SPECIALS, WEAPONS, consumable, durOf, isBroken, isDamaged,
  makeAccessory, makeArmor, makeConsumable, makeKit, makeMaterial, makeShield, makeWeapon, maxDur, slotsOf,
} from '../rules/gear'
import { useKit } from '../rules/smith'
import { RARITY_CHOICES, TIER_COLOR, TIER_LABEL } from '../rules/tiers'
import { ItemArt } from './art'
import { DurBar, Empty, Field, RarityTag, Seg, Sheet, Stepper, confirmBox, toast } from './kit'

const save = (c: Character) => put('chars', c)

export function BodyDoll({ c }: { c: Character }) {
  const at = (slot: string) => c.inventory.find((i) => i.equipped && i.kind === 'accessory' && i.slot === slot)
  const weapons = c.inventory.filter((i) => i.equipped && i.kind === 'weapon')
  const cell = (label: string, it?: Item) => <div className={it ? 'filled' : ''}>{it ? <ItemArt it={it} size={30} /> : null}<span>{it ? it.name : label}</span></div>
  return (
    <div className="doll">
      {cell('Main hand', weapons[0])}{cell('Head', at('head'))}{cell('Off hand', wieldedShield(c) ?? weapons[1])}
      {cell('Hands', at('hands'))}{cell('Body armor', bodyArmor(c))}{cell('Under-layer', underArmor(c))}
      <div style={{ visibility: 'hidden' }} />{cell('Feet', at('feet'))}<div style={{ visibility: 'hidden' }} />
    </div>
  )
}

export function Inventory({ c, editable }: { c: Character; editable: boolean }) {
  const role = useRole()
  const label = usePlayerLabel()
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const enc = encumbrance(c)
  const others = list('chars').filter((x) => x.id !== c.id)
  return (
    <div className="stack">
      <div className="row between">
        <span className={`pill ${enc.over ? 'warn' : ''}`}>Slots {enc.used}/{enc.cap}{enc.over ? ' — over capacity' : ''}</span>
        {role.isDM && editable && <button className="btn small primary" onClick={() => setAdding(true)}>＋ Give item (DM)</button>}
      </div>
      <Purse c={c} editable={editable} />
      <Offers c={c} />
      {c.inventory.length ? c.inventory.map((it) => <ItemRow key={it.id} c={c} it={it} open={open === it.id} onToggle={() => setOpen(open === it.id ? null : it.id)} editable={editable} others={others} label={label} />) : <Empty>The pack is empty.</Empty>}
      {adding && <GiveItemSheet c={c} onClose={() => setAdding(false)} />}
    </div>
  )
}

function stateBadges(it: Item) {
  const out: JSX.Element[] = []
  if (isBroken(it)) out.push(<span key="b" className="pill bad">BROKEN</span>)
  else if (isDamaged(it)) out.push(<span key="d" className="pill warn">Damaged −1 AC</span>)
  if (it.special === 'black' && !it.synced) out.push(<span key="u" className="pill bad">UNSYNCED</span>)
  if (it.forSalvage) out.push(<span key="s" className="pill">for salvage</span>)
  if (it.atForge) out.push(<span key="f" className="pill warn">at the forge</span>)
  if (it.coating?.type) out.push(<span key="c" className="pill">{it.coating.type} oil</span>)
  if (it.coating?.bonusDice) out.push(<span key="e" className="pill">+{it.coating.bonusDice} {it.coating.bonusType}</span>)
  if (it.coating?.crit) out.push(<span key="w" className="pill good">next hit crits</span>)
  if (it.under) out.push(<span key="un" className="pill">under-layer</span>)
  return out
}

function ItemRow({ c, it, open, onToggle, editable, others, label }: { c: Character; it: Item; open: boolean; onToggle: () => void; editable: boolean; others: Character[]; label: (c?: Character) => string }) {
  const [offerTo, setOfferTo] = useState('')
  const md = maxDur(it)
  const equippable = ['weapon', 'armor', 'shield', 'accessory'].includes(it.kind)
  const usable = it.kind === 'consumable' || (it.kind === 'scroll' && !it.spellId) || it.kind === 'kit'
  const equip = () => { const r = toggleEquip(c, it.id); if (r.message) toast(r.message, 'bad'); else save(r.char) }
  return (
    <div className={`item ${it.equipped ? 'equipped' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="row nowrap" style={{ cursor: 'pointer' }} onClick={onToggle}>
        <ItemArt it={it} size={44} />
        <div className="meta">
          <div className="name">{it.name}{it.qty > 1 && <span className="qty"> ×{it.qty}</span>}</div>
          <div className="row" style={{ gap: 4 }}><RarityTag it={it} />{it.equipped && <span className="pill good">equipped</span>}{stateBadges(it)}{slotsOf(it) > 1 && <span className="pill">{slotsOf(it)} slots</span>}</div>
        </div>
        {md > 0 && <DurBar cur={durOf(it)} max={md} />}
      </div>
      {open && (
        <div className="stack" style={{ paddingTop: 8 }}>
          {it.desc && <p className="muted" style={{ fontSize: '.88rem' }}>{it.desc}</p>}
          {it.damage && <p style={{ fontSize: '.88rem' }}>Damage {it.damage} {it.coating?.type ?? it.damageType}</p>}
          {it.abilityNote && <p style={{ fontSize: '.88rem' }}>✦ {it.abilityNote}</p>}
          {editable && (
            <div className="row">
              {equippable && <button className="btn small" onClick={equip}>{it.equipped ? 'Unequip' : 'Equip'}</button>}
              {it.kind === 'armor' && canGoUnder(it.armorId, it.tier) && (it.equipped || !it.under) && <button className="btn small" onClick={() => {
                const main = bodyArmor(c)
                if (!it.under && main && main.id !== it.id && armorDef(main.armorId)?.cat === 'light') return toast('An under-layer only works beneath medium or heavy armor.', 'bad')
                save({ ...c, inventory: c.inventory.map((x) => (x.id === it.id ? { ...x, under: !x.under, equipped: true } : x.under && !it.under ? { ...x, under: false, equipped: false } : x)) })
              }}>{it.under ? 'Wear as main armor' : 'Wear as under-layer'}</button>}
              {it.kind === 'shield' && it.equipped && <Seg value={it.shieldMode ?? 'wielded'} onChange={(m) => save(updateItem(c, it.id, { shieldMode: m }))} options={[{ id: 'wielded', label: 'Wielded' }, { id: 'back', label: 'On back' }, { id: 'planted', label: 'Planted' }]} />}
              {usable && <button className="btn small primary" onClick={() => useItem(c, it)}>Use</button>}
              {it.special === 'black' && (it.synced ? <button className="btn small" onClick={() => save(updateItem(c, it.id, { synced: false, bondedTo: undefined, equipped: false }))}>Release the bond</button> : <button className="btn small primary" onClick={() => { save(updateItem(c, it.id, { synced: true, bondedTo: c.id })); toast(`${c.name} syncs with ${it.name}.`) }}>Sync</button>)}
              {it.special && <button className="btn small" onClick={() => toast(it.abilityNote ?? 'Unique ability (stub) — the DM decides.')}>Invoke unique ability (stub)</button>}
              {['armor', 'weapon', 'shield'].includes(it.kind) && it.tier && !it.special && <button className="btn small" onClick={() => save(updateItem(c, it.id, { forSalvage: !it.forSalvage }))}>{it.forSalvage ? 'Unmark salvage' : 'Mark for salvage'}</button>}
              <button className="btn small ghost" onClick={async () => { if (await confirmBox(`Drop ${it.name}? It's gone for good.`, 'Drop', true)) save(removeItem(c, it.id)) }}>Drop</button>
            </div>
          )}
          {editable && others.length > 0 && (
            <div className="row">
              <select value={offerTo} onChange={(e) => setOfferTo(e.target.value)} style={{ flex: 1, minWidth: 140 }}><option value="">Offer to…</option>{others.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}</select>
              <button className="btn small" disabled={!offerTo} onClick={() => { put('trades', { id: uid(), fromId: c.id, toId: offerTo, itemId: it.id, item: it, qty: it.qty, at: Date.now() }); toast('Offer sent — it stays with you until they accept'); setOfferTo('') }}>Offer</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Use a consumable / kit. Healing rolls here; coatings land on the equipped weapon. */
export async function useItem(c: Character, it: Item) {
  if (it.kind === 'kit' || it.consKey === 'field-repair') {
    const gear = c.inventory.filter((g) => g.tier && maxDur(g) > 0 && durOf(g) < maxDur(g) && !isBroken(g))
    const target = gear.find((g) => g.equipped && g.kind === 'armor') ?? gear[0]
    if (!target) return toast('Nothing here needs (or can take) a kit repair.', 'bad')
    const r = useKit(c, it.id, target.id)
    toast(r.msg, r.ok ? 'good' : 'bad')
    if (r.ok) save(r.char)
    return
  }
  const def = consumable(it.consKey)
  const use = def?.use ?? (it.heal ? { k: 'heal' as const, dice: it.heal } : { k: 'note' as const })
  let next = removeItem(c, it.id, 1)
  const weapon = c.inventory.find((w) => w.kind === 'weapon' && w.equipped)
  switch (use.k) {
    case 'heal': { const n = Math.max(0, roll(use.dice).total); next = { ...next, hp: Math.min(next.maxHp, next.hp + n) }; toast(`${c.name} drinks ${it.name}: +${n} HP`, 'good'); break }
    case 'fullHeal': next = { ...next, hp: next.maxHp }; toast(`${c.name} is fully healed`, 'good'); break
    case 'coatType': case 'coatBonus': case 'whetstone':
      if (!weapon) return toast('Equip a weapon first.', 'bad')
      next = updateItem(next, weapon.id, { coating: { ...weapon.coating, ...(use.k === 'coatType' ? { type: use.type } : use.k === 'coatBonus' ? { bonusDice: use.dice, bonusType: use.type } : { crit: true }) } })
      toast(`${it.name} on ${weapon.name}`); break
    case 'effect':
      if (use.key === 'mending') {
        const a = bodyArmor(c)
        if (a) next = updateItem(next, a.id, { dur: maxDur(a) })
      }
      next = { ...next, effects: [...next.effects.filter((e) => e.key !== use.key), { id: uid(), key: use.key, label: def!.name, until: use.until }] }
      toast(`${def!.name}: ${def!.desc}`); break
    default: toast(`${it.name}: ${it.desc ?? 'used'}`)
  }
  save(next)
}

function Purse({ c, editable }: { c: Character; editable: boolean }) {
  const role = useRole()
  const label = usePlayerLabel()
  const [g, setG] = useState(0)
  const [sv, setS] = useState(0)
  const [to, setTo] = useState('')
  const amt = g * 10 + sv
  const others = list('chars').filter((x) => x.id !== c.id)
  return (
    <div className="card stack">
      <div className="row between"><div className="row"><span className="label">Purse</span><b className="num" style={{ fontSize: '1.2rem' }}>🪙 {coinLabel(c.purse)}</b></div><span className="muted" style={{ fontSize: '.8rem' }}>10 silver = 1 gold</span></div>
      {editable && (
        <>
          <div className="row"><Field label="Gold"><Stepper value={g} min={0} onChange={setG} /></Field><Field label="Silver"><Stepper value={sv} min={0} onChange={setS} /></Field></div>
          <div className="row">
            <button className="btn small" disabled={!amt} onClick={() => { const p = pay(c, amt); if (!p) return toast('Not enough coin!', 'bad'); save(p); toast(`Spent ${coinLabel(fromSilver(amt))}`) }}>Spend</button>
            {role.isDM && <button className="btn small primary" disabled={!amt} onClick={() => { save(receive(c, amt)); toast(`Added ${coinLabel(fromSilver(amt))}`, 'good') }}>Add Gold (DM)</button>}
            {others.length > 0 && <><select value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto', flex: 1, minWidth: 120 }}><option value="">Give coins to…</option>{others.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}</select>
              <button className="btn small" disabled={!amt || !to} onClick={() => { const p = pay(c, amt); if (!p) return toast('Not enough coin!', 'bad'); save(p); patch('chars', to, (x) => receive(x, amt)); toast('Coins sent') }}>Give</button></>}
          </div>
        </>
      )}
    </div>
  )
}

/** Trades wait for the receiver. Accept moves the item; Decline changes nothing. */
export function Offers({ c }: { c: Character }) {
  const s = useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const mine = Object.values(s.cols.trades).filter((t) => t.toId === c.id)
  const sent = Object.values(s.cols.trades).filter((t) => t.fromId === c.id)
  if (!mine.length && !sent.length) return null
  return (
    <div className="card stack" style={{ borderColor: 'var(--accent)' }}>
      {mine.length > 0 && <div className="label">Offers waiting for you</div>}
      {mine.map((t) => {
        const from = s.cols.chars[t.fromId]
        return (
          <div key={t.id} className="row nowrap"><ItemArt it={t.item} size={34} /><div className="grow">{label(from, 'Someone')} offers <b>{t.item.name}</b>{t.qty > 1 ? ` ×${t.qty}` : ''}</div>
            {role.canEdit(c) && <><button className="btn small primary" onClick={() => {
              if (!from) { del('trades', t.id); return }
              const r = acceptTrade(from, c, t.itemId, t.qty)
              if (!r) { toast(`${from.name} doesn't have it anymore.`, 'bad'); del('trades', t.id); return }
              put('chars', r.from); put('chars', r.to); del('trades', t.id); toast(`${t.item.name} is yours`, 'good')
            }}>Accept</button><button className="btn small" onClick={() => del('trades', t.id)}>Decline</button></>}
          </div>
        )
      })}
      {sent.map((t) => <div key={t.id} className="row between"><span className="muted">Offered {t.item.name} to {label(s.cols.chars[t.toId], 'someone')}…</span>{role.canEdit(c) && <button className="btn small ghost" onClick={() => del('trades', t.id)}>Cancel</button>}</div>)}
    </div>
  )
}

// ---------- DM: give items ----------
export function GiveItemSheet({ c, onClose, onGive }: { c?: Character; onClose: () => void; onGive?: (it: Item) => void }) {
  const [cat, setCat] = useState<'armor' | 'weapon' | 'shield' | 'potion' | 'mat' | 'other' | 'custom'>('armor')
  const [tier, setTier] = useState<Tier>('green')
  const give = (it: Item) => {
    if (onGive) onGive(it)
    else if (c) { patch('chars', c.id, (x) => addItem(x, it)); toast(`${it.name} → ${c.name}`, 'good') }
  }
  return (
    <Sheet title={c ? `Give ${c.name} an item` : 'Add an item'} onClose={onClose}>
      <Seg value={cat} onChange={setCat} options={[{ id: 'armor', label: 'Armor' }, { id: 'weapon', label: 'Weapons' }, { id: 'shield', label: 'Shields' }, { id: 'potion', label: 'Potions' }, { id: 'mat', label: 'Materials' }, { id: 'other', label: 'Other' }, { id: 'custom', label: 'Custom' }]} />
      {['armor', 'weapon', 'shield'].includes(cat) && <div className="rarity-row">{TIERS.map((t) => <button key={t} className={`btn small ${t === tier ? 'primary' : ''}`} style={t === tier ? {} : { borderColor: TIER_COLOR[t], color: TIER_COLOR[t] }} onClick={() => setTier(t)}>{TIER_LABEL[t]}</button>)}</div>}
      <div className="stack">
        {cat === 'armor' && ARMOR.map((a) => <Pick key={a.id} it={makeArmor(a.id, tier)} onGive={give} />)}
        {cat === 'weapon' && WEAPONS.map((w) => <Pick key={w.id} it={makeWeapon(w.id, tier)} onGive={give} />)}
        {cat === 'shield' && SHIELDS.map((sh) => <Pick key={sh.id} it={makeShield(sh.id, tier)} onGive={give} />)}
        {cat === 'potion' && CONSUMABLES.map((p) => <Pick key={p.key} it={makeConsumable(p.key)} onGive={give} />)}
        {cat === 'mat' && <>{MATS.map((m) => <Pick key={m} it={makeMaterial(m)} onGive={give} />)}{TIERS.map((t) => <Pick key={t} it={makeKit(t)} onGive={give} />)}</>}
        {cat === 'other' && <>{ACCESSORIES.map((a) => <Pick key={a.id} it={makeAccessory(a.id)} onGive={give} />)}{Object.values(SPECIALS).map((f, i) => <Pick key={i} it={f()} onGive={give} />)}</>}
        {cat === 'custom' && <CustomItem onGive={give} />}
      </div>
    </Sheet>
  )
}
function Pick({ it, onGive }: { it: Item; onGive: (it: Item) => void }) {
  return (
    <div className="item"><ItemArt it={it} size={40} /><div className="meta"><div className="name">{it.name}</div><div className="sub">{it.price ? `${it.price}g · ` : ''}{it.desc}</div></div><button className="btn small primary" onClick={() => onGive({ ...it, id: uid() })}>Give</button></div>
  )
}
function CustomItem({ onGive }: { onGive: (it: Item) => void }) {
  const [it, setIt] = useState<Item>({ id: '', name: '', kind: 'misc', qty: 1 })
  const [rar, setRar] = useState('')
  const r = RARITY_CHOICES.find((x) => x.id === rar)
  return (
    <div className="card stack">
      <div className="grid2">
        <Field label="Name"><input id="custom-item-name" value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} placeholder="e.g. Grimble's lucky ring" /></Field>
        <Field label="Kind"><select value={it.kind} onChange={(e) => setIt({ ...it, kind: e.target.value as ItemKind })}>{['misc', 'weapon', 'consumable', 'scroll'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Rarity"><select value={rar} onChange={(e) => setRar(e.target.value)}><option value="">None</option>{RARITY_CHOICES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>
        <Field label="How many"><Stepper value={it.qty} min={1} onChange={(n) => setIt({ ...it, qty: n })} /></Field>
        {it.kind === 'weapon' && <><Field label="Damage"><input value={it.damage ?? ''} onChange={(e) => setIt({ ...it, damage: e.target.value })} placeholder="1d8" /></Field><Field label="Damage type"><select value={it.damageType ?? 'slashing'} onChange={(e) => setIt({ ...it, damageType: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field></>}
        {it.kind === 'consumable' && <Field label="Heals (dice)"><input value={it.heal ?? ''} onChange={(e) => setIt({ ...it, heal: e.target.value || undefined })} placeholder="optional, e.g. 2d4+2" /></Field>}
        {it.kind === 'scroll' && <Field label="Spell scroll of"><select value={it.spellId ?? ''} onChange={(e) => setIt({ ...it, spellId: e.target.value || undefined })}><option value="">Not a spell</option>{SPELLS.filter((s) => s.damage || s.heal).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
      </div>
      <Field label="Description"><textarea value={it.desc ?? ''} onChange={(e) => setIt({ ...it, desc: e.target.value })} /></Field>
      <button className="btn primary" disabled={!it.name.trim()} onClick={() => onGive({ ...it, id: uid(), name: it.name.trim(), tier: r?.tier, special: r?.special, synced: r?.special === 'black' ? false : undefined })}>Give</button>
    </div>
  )
}
