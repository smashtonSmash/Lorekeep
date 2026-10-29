import { useState } from 'react'
import { getState, list, patch, put, setDoc, useApp } from '../core/store'
import { usePlayerLabel, useRole } from '../core/role'
import type { Character, DamageType, Item, MatTier, Tier, Town as TownT } from '../core/types'
import { PHYSICAL, TIERS, uid } from '../core/types'
import { ARMOR } from '../rules/armor'
import { addItem, coinLabel, giveInspiration, pay, receive, removeItem, toSilver, updateItem } from '../rules/character'
import {
  FAVOR_MAX, FAVOR_MIN, MERCHANT_TRADES, REFUSE_AT, buySilver, buyVaultSlots, clampFavor, deposit, favorOf, fountainGift, markup, mood, newMerchant, offer,
  refuses, removeMerchant, sellSilver, vaultPrice, withdraw,
} from '../rules/economy'
import {
  ACCESSORIES, CONSUMABLES, KIT_PRICE, MATS, MAT_COLOR, MAT_GEAR, MAT_LABEL, SHIELDS, WEAPONS, armorPrice, durOf, isBroken, makeAccessory, makeArmor,
  makeConsumable, makeKit, makeShield, makeWeapon, maxDur, priceOf, repairCost, shieldPrice, WEAPON_PRICE, CRAFT_GOLD,
} from '../rules/gear'
import { craft, craftKit, gearKey, isGear, matCount, merge, repairWithGold, salvage, upgrade, upgradeFee, type Smith } from '../rules/smith'
import { TIER_LABEL, nextTier } from '../rules/tiers'
import { ItemArt } from '../ui/art'
import { Empty, Field, RarityTag, Seg, Stepper, confirmBox, toast } from '../ui/kit'
import { addRecap } from './Loot'

const BUY_FAVOR = 2 // each purchase warms the merchant a little

export default function Town() {
  const s = useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const town = s.docs.town
  const dm = role.isDM && !role.readOnly
  const chars = list('chars').filter((c) => role.isDM || role.mine(c))
  const [who, setWho] = useState<string>(chars[0]?.id ?? '')
  const [tab, setTab] = useState<'market' | 'forge' | 'vault' | 'fountain'>('market')
  const c = s.cols.chars[who] ?? chars[0]
  const place = town.places.find((p) => p.id === town.currentId) ?? town.places[0]
  const setTown = (fn: (t: TownT) => TownT) => setDoc('town', fn)
  const [newTown, setNewTown] = useState('')
  return (
    <div className="stack">
      <div className="row between">
        <div className="row"><h2>⛲ {place?.name ?? 'Town'}</h2>{town.places.length > 1 && <select style={{ width: 'auto' }} value={town.currentId} onChange={(e) => setTown((t) => ({ ...t, currentId: e.target.value }))} disabled={!dm} aria-label="Current town">{town.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>
        {dm && <div className="row"><input placeholder="New town name" value={newTown} onChange={(e) => setNewTown(e.target.value)} style={{ width: 150 }} /><button className="btn small" disabled={!newTown.trim()} onClick={() => { const id = uid(); setTown((t) => ({ ...t, places: [...t.places, { id, name: newTown.trim(), hasFountain: false }], currentId: id })); setNewTown('') }}>Add town</button></div>}
      </div>
      {chars.length ? (
        <div className="row"><span className="label">Shopping as</span>{chars.map((x) => <button key={x.id} className={`chip ${x.id === c?.id ? 'on' : ''}`} onClick={() => setWho(x.id)}>{label(x)} · {coinLabel(x.purse)}</button>)}</div>
      ) : <Empty>Make a character to shop, forge and bank here.</Empty>}
      <Seg value={tab} onChange={setTab} options={[{ id: 'market', label: '🏪 Market' }, { id: 'forge', label: '🔨 Blacksmith' }, { id: 'vault', label: '🏦 Vault' }, ...(place?.hasFountain || dm ? [{ id: 'fountain' as const, label: '⛲ Fountain' }] : [])]} />
      {tab === 'market' && <Market c={c} dm={dm} canAct={!!c && role.canEdit(c)} />}
      {tab === 'forge' && c && <Forge c={c} dm={dm} canAct={role.canEdit(c)} />}
      {tab === 'vault' && <Vault c={c} canAct={!!c && role.canEdit(c)} />}
      {tab === 'fountain' && <Fountain c={c} dm={dm} hasFountain={!!place?.hasFountain} canAct={!!c && role.canEdit(c)} />}
      {dm && <Stash />}
      {dm && chars.length > 0 && (
        <div className="card stack"><div className="label">Give inspiration</div><div className="row">{chars.map((x) => <button key={x.id} className="chip" onClick={() => { const n = giveInspiration(x); if (!n) return toast(`${x.name} already has 2.`); put('chars', n); toast(`${x.name} gains inspiration`, 'good') }}>✨ {x.name} ({x.inspiration}/2)</button>)}</div></div>
      )}
    </div>
  )
}

// ---------- merchants & shop ----------
type Cat = 'potions' | 'armor' | 'weapons' | 'shields' | 'kits' | 'gear' | 'sell'
function Market({ c, dm, canAct }: { c?: Character; dm: boolean; canAct: boolean }) {
  const s = useApp()
  const town = s.docs.town
  const [mId, setMId] = useState<string>('')
  const [cat, setCat] = useState<Cat>('potions')
  const [dmAdjust, setDmAdjust] = useState<number | null>(null)
  const [adding, setAdding] = useState({ name: '', trade: 'General store' })
  const m = town.merchants.find((x) => x.id === mId)
  const favor = c && m ? favorOf(c, m.id) : 0
  const pct = dmAdjust ?? (m ? markup(m, favor) : 0)
  const setFavor = (n: number) => c && m && patch('chars', c.id, (x) => ({ ...x, favor: { ...x.favor, [m.id]: clampFavor(n) } }))
  const buy = (it: Item, gold: number) => {
    if (!c) return
    if (m && refuses(favor)) return toast(`${m.name} refuses to sell to ${c.name}. Favor is too low.`, 'bad')
    const cost = buySilver(gold, pct)
    const paid = pay(c, cost)
    if (!paid) return toast(`${c.name} needs ${coinLabel({ gold: Math.floor(cost / 10), silver: cost % 10 })}.`, 'bad')
    let next = addItem(paid, it)
    if (m) next = { ...next, favor: { ...next.favor, [m.id]: clampFavor(favorOf(next, m.id) + BUY_FAVOR) } }
    put('chars', next)
    addRecap('🛒', `${c.name} bought ${it.name}`)
    toast(`🛒 ${it.name} for ${coinLabel({ gold: Math.floor(cost / 10), silver: cost % 10 })}${m ? ` · favor ${clampFavor(favor + BUY_FAVOR)}` : ''}`, 'good')
  }
  const price = (g: number) => coinLabel({ gold: Math.floor(buySilver(g, pct) / 10), silver: buySilver(g, pct) % 10 })
  const row = (it: Item, gold: number, key: string) => (
    <div key={key} className="item"><ItemArt it={it} size={40} /><div className="meta"><div className="name">{it.name}</div><div className="sub">{it.desc}</div></div>
      <button className="btn small primary" disabled={!canAct} onClick={() => buy({ ...it, id: uid() }, gold)}>{price(gold)}</button></div>
  )
  const tierRows = (make: (t: Tier) => Item, gold: (t: Tier) => number, k: string) => TIERS.map((t) => row(make(t), gold(t), k + t))
  return (
    <div className="stack">
      <div className="row"><button className={`chip ${!m ? 'on' : ''}`} onClick={() => setMId('')}>List price</button>
        {town.merchants.map((x) => { const f = c ? favorOf(c, x.id) : 0; return <button key={x.id} className={`chip ${x.id === mId ? 'on' : ''}`} onClick={() => { setMId(x.id); setDmAdjust(null) }}>{mood(f).emoji} {x.name} <small>{f}</small></button> })}
      </div>
      {m && (
        <div className="card stack">
          <div className="row between"><div><h3>{m.name}</h3><small>{m.trade} · {m.personality}</small></div>
            {dm && <button className="btn small ghost" onClick={async () => { const r = removeMerchant(town, m.id); if (!r.ok) return toast(r.msg!, 'bad'); if (await confirmBox(`Remove ${m.name} from town?`, 'Remove', true)) { setDoc('town', () => r.town); setMId('') } }}>Remove</button>}
          </div>
          {c && <>
            <div className="favor" aria-label={`Favor ${favor} from ${FAVOR_MIN} to ${FAVOR_MAX}`}><b style={{ left: `${((REFUSE_AT - FAVOR_MIN) / (FAVOR_MAX - FAVOR_MIN)) * 100}%` }} /><i style={{ left: `${((favor - FAVOR_MIN) / (FAVOR_MAX - FAVOR_MIN)) * 100}%` }} /></div>
            <div className="row between"><small>−100 · cold</small><b>{mood(favor).emoji} {favor > 0 ? '+' : ''}{favor} {mood(favor).label} with {c.name}</b><small>warm · +100</small></div>
            {dm && <div className="row">{[-10, -5, 5, 10].map((n) => <button key={n} className="btn small" onClick={() => setFavor(favor + n)}>{n > 0 ? '+' : '−'}{Math.abs(n)} Favor</button>)}</div>}
          </>}
          <p className="muted" style={{ fontSize: '.88rem' }}>Starts at {m.baseAdjust > 0 ? '+' : ''}{m.baseAdjust}%. Every 5 favor takes 1% off. At {REFUSE_AT} or lower they won't sell. Each purchase adds +{BUY_FAVOR} favor. <span className="ph">PLACEHOLDER MATH</span></p>
        </div>
      )}
      {dm && (
        <div className="row"><Field label="DM price adjust %"><Stepper value={pct} min={-90} max={300} step={5} onChange={setDmAdjust} /></Field>{dmAdjust != null && <button className="btn small ghost" onClick={() => setDmAdjust(null)}>Back to favor price</button>}</div>
      )}
      <Seg value={cat} onChange={setCat} options={[{ id: 'potions', label: 'Potions' }, { id: 'armor', label: 'Armor' }, { id: 'weapons', label: 'Weapons' }, { id: 'shields', label: 'Shields' }, { id: 'kits', label: 'Kits' }, { id: 'gear', label: 'Gear' }, { id: 'sell', label: 'Sell' }]} />
      <div className="stack">
        {cat === 'potions' && CONSUMABLES.map((p) => row(makeConsumable(p.key), p.price, p.key))}
        {cat === 'armor' && ARMOR.map((a) => <details key={a.id} className="card tight"><summary>{a.name} <small>({a.cat})</small></summary><div className="stack" style={{ paddingTop: 6 }}>{tierRows((t) => makeArmor(a.id, t), (t) => armorPrice(a.id, t), a.id)}</div></details>)}
        {cat === 'weapons' && WEAPONS.map((w) => <details key={w.id} className="card tight"><summary>{w.name} <small>{w.damage} {w.type}</small></summary><div className="stack" style={{ paddingTop: 6 }}>{tierRows((t) => makeWeapon(w.id, t), (t) => WEAPON_PRICE[t], w.id)}</div></details>)}
        {cat === 'shields' && SHIELDS.map((sh) => <details key={sh.id} className="card tight"><summary>{sh.name}</summary><div className="stack" style={{ paddingTop: 6 }}>{tierRows((t) => makeShield(sh.id, t), (t) => shieldPrice(sh.id, t), sh.id)}</div></details>)}
        {cat === 'kits' && TIERS.map((t) => row(makeKit(t), KIT_PRICE[t], 'k' + t))}
        {cat === 'gear' && ACCESSORIES.map((a) => row(makeAccessory(a.id), a.price, a.id))}
        {cat === 'sell' && c && (c.inventory.filter((i) => !i.equipped && priceOf(i) > 0).length ? c.inventory.filter((i) => !i.equipped && priceOf(i) > 0).map((it) => (
          <div key={it.id} className="item"><ItemArt it={it} size={40} /><div className="meta"><div className="name">{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}</div><RarityTag it={it} /></div>
            <button className="btn small" disabled={!canAct} onClick={() => { const sv = sellSilver(priceOf(it)); put('chars', receive(removeItem(c, it.id, 1), sv)); addRecap('💰', `${c.name} sold ${it.name}`); toast(`Sold for ${coinLabel({ gold: Math.floor(sv / 10), silver: sv % 10 })}`, 'good') }}>Sell {coinLabel({ gold: Math.floor(sellSilver(priceOf(it)) / 10), silver: sellSilver(priceOf(it)) % 10 })}</button></div>
        )) : <Empty>Nothing to sell (unequip gear first).</Empty>)}
        {cat === 'sell' && <p className="muted" style={{ fontSize: '.85rem' }}>Merchants buy at half list price. <span className="ph">PLACEHOLDER</span></p>}
      </div>
      {dm && (
        <div className="card stack">
          <div className="label">Add a merchant</div>
          <div className="row"><input placeholder="Name" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} style={{ flex: '1 1 140px' }} />
            <select value={adding.trade} onChange={(e) => setAdding({ ...adding, trade: e.target.value })} style={{ flex: '1 1 140px' }}>{MERCHANT_TRADES.map((t) => <option key={t}>{t}</option>)}</select>
            <button className="btn small primary" disabled={!adding.name.trim()} onClick={() => { setDoc('town', (t) => ({ ...t, merchants: [...t.merchants, newMerchant(adding.name, adding.trade)] })); setAdding({ ...adding, name: '' }) }}>Add</button></div>
          <small>There must always be at least one merchant.</small>
        </div>
      )}
    </div>
  )
}

// ---------- blacksmith ----------
function Forge({ c, dm, canAct }: { c: Character; dm: boolean; canAct: boolean }) {
  const [mode, setMode] = useState<'repair' | 'upgrade' | 'craft' | 'merge' | 'salvage'>('repair')
  const [sworn, setSworn] = useState<DamageType>('slashing')
  const [mat, setMat] = useState<MatTier>('green')
  const [craftWhat, setCraftWhat] = useState('weapon:longsword')
  // Players leave work at the forge until the DM taps Ready. The DM's own work is instant.
  const done = (r: Smith, holdIds: string[] = []) => {
    toast(r.msg, r.ok ? 'good' : 'bad')
    if (!r.ok) return
    let ch = r.char
    if (!dm) for (const id of [...holdIds, ...(r.item ? [r.item.id] : [])]) if (ch.inventory.some((i) => i.id === id)) ch = updateItem(ch, id, { atForge: true, equipped: false })
    put('chars', ch)
    addRecap('🔨', r.msg)
  }
  const gear = c.inventory.filter((i) => isGear(i) && i.tier && !i.special)
  const atForge = c.inventory.filter((i) => i.atForge)
  const groups = new Map<string, Item[]>()
  for (const it of gear) { const k = gearKey(it); if (k) groups.set(k, [...(groups.get(k) ?? []), ...Array(it.qty).fill(it)]) }
  const [ck, cid] = craftWhat.split(':') as ['armor' | 'weapon' | 'shield', string]
  const needsSwear = (ck === 'armor' && (cid === 'plate' || cid === 'half-plate') && MAT_GEAR[mat] === 'mythic')
  return (
    <div className="stack">
      {atForge.length > 0 && (
        <div className="banner stack">
          <b>At the forge</b>
          {atForge.map((it) => <div key={it.id} className="row between"><span>{it.name}</span>{dm ? <button className="btn small primary" onClick={() => patch('chars', c.id, (x) => updateItem(x, it.id, { atForge: false }))}>Ready</button> : <small>waiting on the DM</small>}</div>)}
        </div>
      )}
      <Seg value={mode} onChange={(v) => { setMode(v) }} options={[{ id: 'repair', label: '🛠 Repair' }, { id: 'upgrade', label: '⬆ Upgrade 3→1' }, { id: 'craft', label: '✨ Craft' }, { id: 'merge', label: '🔗 Merge' }, { id: 'salvage', label: '🪓 Salvage' }]} />
      {mode === 'repair' && (gear.filter((i) => durOf(i) < maxDur(i)).length ? gear.filter((i) => durOf(i) < maxDur(i)).map((it) => {
        const missing = maxDur(it) - durOf(it)
        return (
          <div key={it.id} className="item"><ItemArt it={it} size={40} /><div className="meta"><div className="name">{it.name}</div><div className="sub">{durOf(it)}/{maxDur(it)}{isBroken(it) ? ' · BROKEN (cost ×2)' : ''} · {repairCost(it, 1)}g per point</div></div>
            <button className="btn small primary" disabled={!canAct} onClick={() => done(repairWithGold(c, it.id), [it.id])}>Fix all {repairCost(it, missing)}g</button></div>
        )
      }) : <Empty>Nothing needs repair. Kits are used from the pack on the Characters tab.</Empty>)}
      {mode === 'upgrade' && (
        <>
          <p className="muted">Three of the same piece and tier become one of the next tier. Keeps the lowest durability. Fee: Common 5g · Rare 15g · Ultra Rare 50g · Legendary 150g (medium ×2, heavy ×5).</p>
          {[...groups.entries()].map(([k, items]) => {
            const it = items[0]
            const up = nextTier(it.tier!)
            const ok = items.length >= 3 && up
            const swear = up === 'mythic' && it.kind === 'armor' && (it.armorId === 'plate' || it.armorId === 'half-plate')
            return (
              <div key={k} className="item"><ItemArt it={it} size={40} /><div className="meta"><div className="name">{it.name} ×{items.length}</div><div className="sub">{up ? `→ ${TIER_LABEL[up]} · ${upgradeFee(it)}g` : 'Already Mythic'}</div></div>
                {swear && <select style={{ width: 'auto' }} value={sworn} onChange={(e) => setSworn(e.target.value as DamageType)} aria-label="Sworn type">{PHYSICAL.map((t) => <option key={t}>{t}</option>)}</select>}
                <button className="btn small primary" disabled={!ok || !canAct} onClick={() => done(upgrade(c, items.slice(0, 3).map((x) => x.id), swear ? sworn : undefined))}>Upgrade</button></div>
            )
          })}
          {!groups.size && <Empty>No tiered gear in the pack.</Empty>}
        </>
      )}
      {mode === 'craft' && (
        <div className="card stack">
          <MatCounts c={c} />
          <div className="grid2">
            <Field label="Material (4 needed)"><select value={mat} onChange={(e) => setMat(e.target.value as MatTier)}>{MATS.filter((m) => MAT_GEAR[m]).map((m) => <option key={m} value={m}>{MAT_LABEL[m]} → {TIER_LABEL[MAT_GEAR[m]!]} ({CRAFT_GOLD[MAT_GEAR[m]!]}g) · have {matCount(c, m)}</option>)}</select></Field>
            <Field label="Make"><select value={craftWhat} onChange={(e) => setCraftWhat(e.target.value)}>
              <optgroup label="Weapons">{WEAPONS.map((w) => <option key={w.id} value={`weapon:${w.id}`}>{w.name}</option>)}</optgroup>
              <optgroup label="Armor">{ARMOR.map((a) => <option key={a.id} value={`armor:${a.id}`}>{a.name}</option>)}</optgroup>
              <optgroup label="Shields">{SHIELDS.map((sh) => <option key={sh.id} value={`shield:${sh.id}`}>{sh.name}</option>)}</optgroup>
            </select></Field>
            {needsSwear && <Field label="Swear a type (Mythic)"><select value={sworn} onChange={(e) => setSworn(e.target.value as DamageType)}>{PHYSICAL.map((t) => <option key={t}>{t}</option>)}</select></Field>}
          </div>
          <div className="row"><button className="btn primary" disabled={!canAct} onClick={() => done(craft(c, mat, { kind: ck, id: cid }, needsSwear ? sworn : undefined))}>✨ Craft</button>
            <button className="btn" disabled={!canAct} onClick={() => done(craftKit(c, mat))}>Make a repair kit (2 {MAT_LABEL[mat]})</button></div>
          <small>Gray material only merges — it doesn't craft gear or kits.</small>
        </div>
      )}
      {mode === 'merge' && (
        <div className="card stack">
          <MatCounts c={c} />
          <p className="muted">Three of a color → one of the next (Gray → Green → Blue → Purple → Orange → Red). {1} silver each. <span className="ph">PLACEHOLDER FEE</span></p>
          <div className="row">{MATS.slice(0, -1).map((m) => <button key={m} className="btn small" style={{ borderColor: MAT_COLOR[m] }} disabled={!canAct || matCount(c, m) < 3} onClick={() => done(merge(c, m))}>🔗 3 {MAT_LABEL[m]}</button>)}</div>
        </div>
      )}
      {mode === 'salvage' && (
        <>
          <p className="muted">Broken → 1 material of its tier. Up to 65% durability → 2. Above 65% → 2, plus 2 of the tier below. Special and Named Mythic gear can't be salvaged.</p>
          {gear.length ? [...gear].sort((a, b) => Number(!!b.forSalvage) - Number(!!a.forSalvage)).map((it) => (
            <div key={it.id} className="item"><ItemArt it={it} size={40} /><div className="meta"><div className="name">{it.name}{it.forSalvage ? ' · marked' : ''}</div><div className="sub">{durOf(it)}/{maxDur(it)}</div></div>
              <button className="btn small danger" disabled={!canAct} onClick={async () => { if (await confirmBox(`Break down ${it.name}?`, 'Salvage', true)) done(salvage(c, it.id)) }}>🪓 Salvage</button></div>
          )) : <Empty>No tiered gear to salvage.</Empty>}
        </>
      )}
    </div>
  )
}
const MatCounts = ({ c }: { c: Character }) => <div className="row">{MATS.map((m) => <span key={m} className="pill" style={{ borderColor: MAT_COLOR[m] }}>{MAT_LABEL[m]} {matCount(c, m)}</span>)}</div>

// ---------- vault ----------
function Vault({ c, canAct }: { c?: Character; canAct: boolean }) {
  const s = useApp()
  const v = s.docs.town.vault
  const label = usePlayerLabel()
  const run = (r: { ok: boolean; char: Character; town: TownT; msg: string }) => { toast(r.msg, r.ok ? 'good' : 'bad'); if (r.ok) { put('chars', r.char); setDoc('town', (t) => ({ ...t, vault: r.town.vault })) } }
  return (
    <div className="stack">
      <div className="card row between"><div><h3>Town Vault</h3><small>One shared bank for the whole party — the same in every town.</small></div><b className="num">{v.items.length}/{v.slots} slots</b></div>
      {c && canAct && <button className="btn" onClick={() => run(buyVaultSlots(getState().cols.chars[c.id], getState().docs.town))}>＋5 slots for {vaultPrice(v.blocks)}g ({c.name} pays)</button>}
      <div className="label">In the vault</div>
      {v.items.length ? v.items.map((it) => (
        <div key={it.id} className="item"><ItemArt it={it} size={38} /><div className="meta"><div className="name">{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}</div><RarityTag it={it} /></div>
          {c && canAct && <button className="btn small" onClick={() => run(withdraw(getState().cols.chars[c.id], getState().docs.town, it.id))}>Take ({c.name})</button>}</div>
      )) : <Empty>Empty.</Empty>}
      {c && canAct && (
        <>
          <div className="label">Deposit from {label(c)}</div>
          {c.inventory.filter((i) => !i.equipped).map((it) => (
            <div key={it.id} className="item"><ItemArt it={it} size={34} /><div className="meta"><div className="name">{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}</div></div>
              <button className="btn small" onClick={() => run(deposit(getState().cols.chars[c.id], getState().docs.town, it.id))}>Deposit</button></div>
          ))}
        </>
      )}
    </div>
  )
}

// ---------- fountain ----------
function Fountain({ c, dm, hasFountain, canAct }: { c?: Character; dm: boolean; hasFountain: boolean; canAct: boolean }) {
  const s = useApp()
  const f = s.docs.town.fountain
  const [g, setG] = useState(1)
  const [sv, setSv] = useState(0)
  const [peek, setPeek] = useState(false)
  if (!hasFountain) return (
    <div className="card stack"><p>This town has no wishing fountain.</p>{dm && <button className="btn" onClick={() => setDoc('town', (t) => ({ ...t, places: t.places.map((p) => (p.id === t.currentId ? { ...p, hasFountain: true } : p)) }))}>Build a fountain here</button>}</div>
  )
  const toss = () => {
    if (!c) return
    const amt = g * 10 + sv
    const paid = pay(c, amt)
    if (!paid || !amt) return toast('Not enough coin!', 'bad')
    const r = offer(f, amt)
    let next = paid
    if (r.granted) next = addItem(next, fountainGift())
    put('chars', next)
    setDoc('town', (t) => ({ ...t, fountain: r.fountain }))
    addRecap('⛲', r.granted ? `The fountain accepted ${c.name}'s offering!` : `${c.name} tossed ${coinLabel({ gold: g, silver: sv })} into the fountain`)
    toast(r.granted ? '✨ The fountain glows and accepts the offering! A gift appears in the pack.' : 'The coins sink. Nothing happens… yet.', r.granted ? 'good' : undefined)
  }
  return (
    <div className="card stack">
      <h3>Wishing fountain</h3>
      <p className="muted">Toss coins in. The fountain keeps them all. When the party has offered enough, something happens.</p>
      {c && canAct && <div className="row"><Field label="Gold"><Stepper value={g} min={0} onChange={setG} /></Field><Field label="Silver"><Stepper value={sv} min={0} onChange={setSv} /></Field><button className="btn primary" onClick={toss}>Toss coins ({c.name})</button></div>}
      {dm && (
        <div className="banner stack">
          <label className="toggle"><input type="checkbox" checked={peek} onChange={(e) => setPeek(e.target.checked)} /> DM peek</label>
          {peek && <p className="num">Pool: {coinLabel({ gold: Math.floor(f.silver / 10), silver: f.silver % 10 })} of a secret {f.threshold ?? '(rolled on the first coin from 10 / 50 / 100 / 200)'}{f.threshold ? 'g' : ''}. Prize: <span className="ph">PLACEHOLDER</span></p>}
        </div>
      )}
    </div>
  )
}

// ---------- party stash ----------
function Stash() {
  const s = useApp()
  const st = s.docs.town.stash
  const chars = list('chars')
  const [who, setWho] = useState(chars[0]?.id ?? '')
  const [amt, setAmt] = useState(1)
  const c = s.cols.chars[who]
  const setSt = (fn: (x: TownT['stash']) => TownT['stash']) => setDoc('town', (t) => ({ ...t, stash: fn(t.stash) }))
  return (
    <div className="card stack">
      <div className="row between"><h3>Party stash</h3><label className="toggle"><input type="checkbox" checked={st.on} onChange={(e) => setSt((x) => ({ ...x, on: e.target.checked }))} /> Shared pool on</label></div>
      {st.on && <>
        <div className="row"><b className="num">🪙 {st.gold}g {st.silver}s</b>{st.items.length > 0 && <span className="muted">· {st.items.length} items</span>}</div>
        <div className="row"><select value={who} onChange={(e) => setWho(e.target.value)} style={{ width: 'auto' }}>{chars.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><Stepper value={amt} min={1} onChange={setAmt} label="gold" />
          <button className="btn small" disabled={!c} onClick={() => { const p = c && pay(c, amt * 10); if (!p) return toast('Not enough coin!', 'bad'); put('chars', p); setSt((x) => ({ ...x, gold: x.gold + amt })) }}>Deposit {amt}g</button>
          <button className="btn small" disabled={!c || toSilver(st) < amt * 10} onClick={() => { const left = toSilver(st) - amt * 10; patch('chars', c!.id, (x) => receive(x, amt * 10)); setSt((x) => ({ ...x, gold: Math.floor(left / 10), silver: left % 10 })) }}>Withdraw {amt}g</button></div>
        {st.items.map((it) => <div key={it.id} className="item"><ItemArt it={it} size={34} /><div className="meta"><div className="name">{it.name}</div></div>{c && <button className="btn small" onClick={() => { patch('chars', c.id, (x) => addItem(x, it)); setSt((x) => ({ ...x, items: x.items.filter((i) => i.id !== it.id) })) }}>Give to {c.name}</button>}</div>)}
        {c && c.inventory.filter((i) => !i.equipped).length > 0 && <select value="" onChange={(e) => { const it = c.inventory.find((i) => i.id === e.target.value); if (!it) return; put('chars', removeItem(c, it.id)); setSt((x) => ({ ...x, items: [...x.items, it] })) }}><option value="">Put one of {c.name}'s items in the stash…</option>{c.inventory.filter((i) => !i.equipped).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
      </>}
    </div>
  )
}
