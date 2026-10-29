// Online play: sign in, start or join a campaign, share the invite link, and manage your account.
import { useEffect, useState } from 'react'
import { useApp } from '../core/store'
import {
  CAMPAIGN_KEY, JOIN_KEY, createCampaign, currentUser, deleteAccount, inviteLink, joinCampaign, leaveCampaign, myCampaigns, sendMagicLink,
  signInPassword, signOut, signUpPassword, type Campaign,
} from '../cloud/supabase'
import { Field, Seg, confirmBox, toast } from './kit'

const NAME_KEY = 'lorekeep.displayName'
const get = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* private mode */ } }
/** Switching campaigns reopens the app on the new one. */
export function openCampaign(id: string | null) {
  set(CAMPAIGN_KEY, id)
  try { history.replaceState(null, '', location.pathname + location.search) } catch { /* sandboxed */ }
  location.reload()
}

export function CloudPanel() {
  const s = useApp()
  const here = s.viewer.backend === 'cloud' ? s.viewer.campaign : undefined
  const [user, setUser] = useState<{ id: string; email?: string } | null | undefined>(undefined)
  const [camps, setCamps] = useState<Campaign[]>([])
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [how, setHow] = useState<'link' | 'password'>('link')
  const [name, setName] = useState(get(NAME_KEY) ?? '')
  const [newName, setNewName] = useState('')
  const [code, setCode] = useState(get(JOIN_KEY) ?? '')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const refresh = async () => {
    try {
      const u = await currentUser()
      setUser(u)
      if (u) setCamps(await myCampaigns(u.id))
    } catch (e) { setUser(null); setMsg((e as Error).message) }
  }
  useEffect(() => { refresh() }, [])
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setMsg('')
    try { await fn() } catch (e) { setMsg((e as Error).message) } finally { setBusy('') }
  }
  const needName = () => { if (!name.trim()) { setMsg('Add your name first — it shows next to your character.'); return true } set(NAME_KEY, name.trim()); return false }

  if (user === undefined) return <p className="muted">Connecting…</p>

  if (!user) return (
    <div className="stack">
      <p>Sign in to run a campaign or join your friends'. Everyone uses the same link; your sign-in keeps your characters yours.</p>
      <Field label="Email"><input id="cloud-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
      <Seg value={how} onChange={setHow} options={[{ id: 'link', label: 'Email me a link' }, { id: 'password', label: 'Use a password' }]} />
      {how === 'link'
        ? <button className="btn primary" disabled={!email.includes('@') || !!busy} onClick={() => run('link', async () => { await sendMagicLink(email); setMsg(`Check ${email.trim()} and tap the link — it opens LoreKeep signed in.`) })}>{busy ? 'Sending…' : 'Send sign-in link'}</button>
        : <>
          <Field label="Password (6+ characters)"><input id="cloud-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <div className="row">
            <button className="btn primary" disabled={!email.includes('@') || pw.length < 6 || !!busy} onClick={() => run('in', async () => { await signInPassword(email, pw); await refresh() })}>Sign in</button>
            <button className="btn" disabled={!email.includes('@') || pw.length < 6 || !!busy} onClick={() => run('up', async () => { const r = await signUpPassword(email, pw); if (r === 'check-email') setMsg('Account made. Confirm it from the email we sent, then sign in.'); else await refresh() })}>Create account</button>
          </div>
        </>}
      {msg && <div className="banner">{msg}</div>}
    </div>
  )

  return (
    <div className="stack">
      <p className="muted">Signed in as {user.email}</p>
      <Field label="Your name at the table" hint="Shows next to your character, like “Kestrel (Sam)”"><input id="cloud-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && set(NAME_KEY, name.trim())} placeholder="e.g. Sam" /></Field>
      {here && (
        <div className="card stack" style={{ borderColor: 'var(--accent)' }}>
          <div className="row between"><b>☁ {here.name}</b><span className="pill">Code {here.code}</span></div>
          <div className="row">
            <button className="btn small primary" onClick={async () => { try { await navigator.clipboard.writeText(inviteLink(here.code)); toast('Invite link copied — send it to your players', 'good') } catch { setMsg(inviteLink(here.code)) } }}>📋 Copy invite link</button>
            <button className="btn small" onClick={() => openCampaign(null)}>📱 Use this device only</button>
          </div>
          <small className="num" style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{inviteLink(here.code)}</small>
        </div>
      )}
      {camps.length > 0 && <div className="label">Your campaigns</div>}
      {camps.map((c) => (
        <div key={c.id} className="item">
          <div className="meta"><div className="name">{c.role === 'dm' ? '👑 ' : '🎲 '}{c.name}</div><div className="sub">{c.role === 'dm' ? 'You run this one' : 'You play in this one'} · code {c.code}</div></div>
          {here?.id === c.id ? <span className="pill good">open</span> : <button className="btn small primary" onClick={() => openCampaign(c.id)}>Open</button>}
          <button className="btn small ghost" onClick={async () => { if (await confirmBox(c.role === 'dm' ? `Leave ${c.name}? You'll stop being its DM.` : `Leave ${c.name}?`, 'Leave', true)) run('leave', async () => { await leaveCampaign(c.id, user.id); if (here?.id === c.id) openCampaign(null); else await refresh() }) }}>Leave</button>
        </div>
      ))}
      <div className="card stack">
        <div className="label">👑 Start a campaign (you're the DM)</div>
        <div className="row nowrap"><input id="cloud-new" placeholder="Campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn primary" disabled={!!busy} onClick={() => { if (needName()) return; run('new', async () => { const c = await createCampaign(newName || 'Our campaign', name.trim()); openCampaign(c.id) }) }}>Start</button></div>
      </div>
      <div className="card stack">
        <div className="label">🎲 Join a campaign</div>
        <div className="row nowrap"><input id="cloud-code" placeholder="6-letter code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '.15em' }} />
          <button className="btn primary" disabled={code.trim().length < 6 || !!busy} onClick={() => { if (needName()) return; run('join', async () => { const c = await joinCampaign(code, name.trim()); set(JOIN_KEY, null); openCampaign(c.id) }) }}>Join</button></div>
      </div>
      {msg && <div className="banner">{msg}</div>}
      <div className="row between">
        <button className="btn small ghost" onClick={() => run('out', async () => { await signOut(); if (here) openCampaign(null); else await refresh() })}>Sign out</button>
        <button className="btn small ghost" style={{ color: 'var(--bad)' }} onClick={async () => { if (await confirmBox('Delete your LoreKeep account? Campaigns you run are deleted for everyone. This cannot be undone.', 'Delete account', true)) run('del', async () => { await deleteAccount(); openCampaign(null) }) }}>Delete my account</button>
      </div>
    </div>
  )
}
