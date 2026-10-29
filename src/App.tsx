import { useEffect, useRef, useState } from 'react'
import { del, put, exportAll, getState, hasLocalData, importAll, list, setDoc, setLocal, start, uploadLocalToTable, useApp } from './core/store'
import { useRole, usePlayerLabel } from './core/role'
import { seed } from './core/seed'
import { Overlays, Sheet, confirmBox, toast } from './ui/kit'
import { ItemArt } from './ui/art'
import Battle from './screens/Battle'
import Characters from './screens/Characters'
import Dice from './screens/Dice'
import Campaign from './screens/Campaign'
import Loot, { takeFromChest } from './screens/Loot'
import Casino, { CasinoDealer } from './screens/Casino'
import Town from './screens/Town'
import Rules from './screens/Rules'

const TABS = [
  { id: 'battle', label: 'Battle', icon: '⚔️' },
  { id: 'characters', label: 'Characters', icon: '🛡️' },
  { id: 'dice', label: 'Dice', icon: '🎲' },
  { id: 'campaign', label: 'Campaign', icon: '📜' },
  { id: 'loot', label: 'Loot', icon: '💎' },
  { id: 'casino', label: 'Casino', icon: '🎰' },
  { id: 'town', label: 'Town', icon: '⛲' },
  { id: 'rules', label: 'DM', icon: '📋' },
] as const
type TabId = (typeof TABS)[number]['id']
const fromHash = (): TabId | null => { const h = location.hash.slice(1); return TABS.some((t) => t.id === h) ? (h as TabId) : null }

export default function App() {
  const s = useApp()
  const role = useRole()
  const [setup, setSetup] = useState(false)
  const tab = (TABS.some((t) => t.id === s.local.tab) ? s.local.tab : 'battle') as TabId

  useEffect(() => { start(seed) }, [])
  useEffect(() => {
    const h = fromHash(); if (h && h !== getState().local.tab) setLocal((l) => ({ ...l, tab: h }))
    const on = () => { const t = fromHash(); if (t) setLocal((l) => ({ ...l, tab: t })) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (t: TabId) => {
    setLocal((l) => ({ ...l, tab: t }))
    try { history.replaceState(null, '', '#' + t) } catch { /* sandboxed */ }
    window.scrollTo({ top: 0 })
  }

  if (!s.ready) return <div className="reveal"><h1 className="brand"><b>✦</b> LoreKeep</h1><p className="muted">Opening the table…</p></div>

  const Screen = { battle: Battle, characters: Characters, dice: Dice, campaign: Campaign, loot: Loot, casino: Casino, town: Town, rules: Rules }[tab]
  return (
    <>
      <header className="top">
        <div className="brand"><b>✦</b> LoreKeep</div>
        <div className="grow" />
        {s.viewer.mode === 'table' ? <span className="pill good" title="Everyone with this link sees the same campaign">☁ Table</span> : <span className="pill" title="Saved on this device only">📱 This device</span>}
        <button className="btn small" onClick={() => setSetup(true)}>{role.isDM ? '👑 DM' : '🎲 Player'}</button>
      </header>
      {s.error && <div className="banner bad" style={{ margin: '10px 16px 0' }}>{s.error}</div>}
      {role.readOnly && <div className="banner" style={{ margin: '10px 16px 0' }}>👁 View only. Ask the DM to share this table with you as an editor so you can play.</div>}
      <main key={tab}><Welcome /><Screen /></main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => go(t.id)} aria-current={t.id === tab}><span className="ic">{t.icon}</span>{t.label}</button>)}
      </nav>
      {setup && <SetupSheet onClose={() => setSetup(false)} />}
      {role.isDM && !role.readOnly && <CasinoDealer />}
      <RevealOverlay />
      <InspirationOrb />
      <LevelBanner />
      <Overlays />
    </>
  )
}

function SetupSheet({ onClose }: { onClose: () => void }) {
  const s = useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const chars = list('chars')
  const table = s.viewer.mode === 'table'
  const [backup, setBackup] = useState('')
  const samples = chars.some((c) => c.sample) || list('wiki').some((w) => w.sample) || s.docs.encounter.combatants.some((c) => c.sample)
  const removeSamples = async () => {
    if (!(await confirmBox('Remove all sample characters, monsters and wiki pages? Your own data stays.', 'Remove samples', true))) return
    chars.filter((c) => c.sample).forEach((c) => del('chars', c.id))
    list('wiki').filter((w) => w.sample).forEach((w) => del('wiki', w.id))
    setDoc('encounter', (e) => ({ ...e, combatants: e.combatants.filter((c) => !c.sample && !(c.characterId && chars.find((x) => x.id === c.characterId)?.sample)) }))
    toast('Samples removed')
  }
  return (
    <Sheet title="Table & roles" onClose={onClose}>
      <div className="card stack">
        <div className="label">Where this campaign lives</div>
        {table
          ? <p>☁ <b>Shared table.</b> Everyone you share this page with sees the same campaign live — battle, sheets, loot, town. The artifact's owner is the DM.</p>
          : <p>📱 <b>This device only.</b> Everything is saved in this browser. Open LoreKeep as a claude.ai artifact to play together across phones.</p>}
        {table && s.viewer.isOwner && hasLocalData() && <button className="btn" onClick={async () => { if (await confirmBox('Copy the characters, chests and notes saved on this device up to the shared table?', 'Copy up')) { uploadLocalToTable(); toast('Copied to the table', 'good') } }}>⬆ Copy this device's campaign to the table</button>}
      </div>
      <div className="card stack">
        <div className="label">Who's holding this phone?</div>
        {(!table || s.viewer.isOwner) && (
          <div className="seg">
            <button className={role.isDM ? 'on' : ''} onClick={() => setLocal((l) => ({ ...l, role: 'dm' }))}>👑 DM</button>
            <button className={!role.isDM ? 'on' : ''} onClick={() => setLocal((l) => ({ ...l, role: 'player' }))}>🎲 Player</button>
          </div>
        )}
        {table && !s.viewer.isOwner && <p>You're a player. Make a character on the Characters tab and it's yours — only you and the DM can change it.</p>}
        {!table && !role.isDM && (
          <>
            <p className="muted">Pick the characters this player controls. The DM view is one tap away above.</p>
            <div className="row">{chars.map((c) => {
              const on = s.local.playerChars.includes(c.id)
              return <button key={c.id} className={`chip ${on ? 'on' : ''}`} onClick={() => setLocal((l) => ({ ...l, playerChars: on ? l.playerChars.filter((x) => x !== c.id) : [...l.playerChars, c.id] }))}>{label(c)}</button>
            })}</div>
          </>
        )}
        {table && s.viewer.isOwner && !role.isDM && <p className="muted">You're seeing the table as a player sees it. Characters you made yourself are yours.</p>}
      </div>
      {role.isDM && (
        <div className="card stack">
          <div className="label">Backup</div>
          <div className="row">
            <button className="btn" onClick={() => { setBackup(exportAll()); toast('Backup text below — copy and keep it somewhere safe') }}>Make backup text</button>
            <button className="btn" onClick={async () => { try { importAll(backup); toast('Backup restored', 'good') } catch (e) { toast((e as Error).message || 'That text is not a LoreKeep backup', 'bad') } }} disabled={!backup.trim()}>Restore from text</button>
          </div>
          <textarea id="backup-text" placeholder="Paste a backup here to restore it" value={backup} onChange={(e) => setBackup(e.target.value)} onFocus={(e) => e.target.select()} />
          {samples && <button className="btn danger" onClick={removeSamples}>Remove sample data</button>}
        </div>
      )}
    </Sheet>
  )
}

/** A brand-new shared table is empty: offer the sample party or a clean start. */
function Welcome() {
  const s = useApp()
  const [gone, setGone] = useState(false)
  if (gone || s.viewer.mode !== 'table' || !s.viewer.isOwner || list('chars').length || s.docs.encounter.combatants.length || list('wiki').length) return null
  return (
    <div className="card stack" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
      <h2>Welcome to your table</h2>
      <p>This is your campaign, and you're the DM. Share this page with your players as editors and they'll join live.</p>
      <div className="row">
        <button className="btn primary" onClick={() => { const x = seed(); x.chars.forEach((c) => put('chars', c)); x.wiki.forEach((w) => put('wiki', w)); setDoc('encounter', () => x.encounter); toast('Sample party added — remove it any time under 👑 DM', 'good') }}>Add the sample party</button>
        <button className="btn" onClick={() => setGone(true)}>Start fresh</button>
      </div>
    </div>
  )
}

/** Players see a full-screen reveal while the DM has a chest revealed. */
function RevealOverlay() {
  useApp()
  const role = useRole()
  const label = usePlayerLabel()
  const [dismissed, setDismissed] = useState<number | null>(null)
  const chest = list('chests').find((k) => k.revealedAt && !k.closed)
  if (!chest || role.isDM || dismissed === chest.revealedAt) return null
  const mine = list('chars').filter(role.mine)
  return (
    <div className="reveal" role="dialog" aria-label="Treasure revealed">
      <div className="label">The DM reveals</div>
      <h1>{chest.name}</h1>
      <div className="stack" style={{ width: 'min(100%, 460px)' }}>
        {chest.items.map((it) => {
          const taker = chest.takenBy[it.id]
          return (
            <div key={it.id} className="item">
              <ItemArt it={it} size={48} />
              <div className="meta"><div className="name">{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}</div><div className="sub">{taker ? `Taken by ${taker}` : it.desc}</div></div>
              {!taker && chest.allowTake && !role.readOnly && mine.map((c) => <button key={c.id} className="btn small primary" onClick={() => { takeFromChest(chest.id, it.id, c.id, label(c)); toast(`${c.name} takes ${it.name}`, 'good') }}>{mine.length > 1 ? c.name : 'Take'}</button>)}
            </div>
          )
        })}
        {(chest.gold > 0 || chest.silver > 0) && <div className="card">💰 {chest.gold}g {chest.silver}s in the chest</div>}
      </div>
      {!chest.allowTake && <p className="muted">The DM will hand these out.</p>}
      <button className="btn" onClick={() => setDismissed(chest.revealedAt!)}>Close</button>
    </div>
  )
}

/** A white orb when one of my characters is newly given inspiration — never on load. */
function InspirationOrb() {
  const role = useRole()
  const chars = list('chars').filter(role.mine)
  const seen = useRef<Map<string, number>>(new Map())
  const [burst, setBurst] = useState<{ name: string; key: number } | null>(null)
  useEffect(() => {
    for (const c of chars) {
      const ping = c.inspirationPing ?? 0
      const prev = seen.current.get(c.id)
      seen.current.set(c.id, ping)
      if (prev !== undefined && ping > prev) setBurst({ name: c.name, key: ping })
    }
  })
  useEffect(() => { if (!burst) return; const t = setTimeout(() => setBurst(null), 2500); return () => clearTimeout(t) }, [burst])
  return burst ? <div className="orb" key={burst.key}><span>✨ {burst.name} is inspired</span></div> : null
}

function LevelBanner() {
  const chars = list('chars')
  const seen = useRef<Map<string, number>>(new Map())
  const [b, setB] = useState<{ text: string; key: number } | null>(null)
  useEffect(() => {
    for (const c of chars) {
      const p = c.levelPing ?? 0
      const prev = seen.current.get(c.id)
      seen.current.set(c.id, p)
      if (prev !== undefined && p > prev) setB({ text: `⬆ ${c.name} reached level ${c.level}!`, key: p })
    }
  })
  useEffect(() => { if (!b) return; const t = setTimeout(() => setB(null), 3200); return () => clearTimeout(t) }, [b])
  return b ? <div className="levelup" key={b.key}>{b.text}</div> : null
}

