import { useEffect, useRef, useState } from 'react'
import { del, list, put, setDoc, useApp } from '../core/store'
import { useRole } from '../core/role'
import { WIKI_CATEGORIES, uid, type WikiPage } from '../core/types'
import { Empty, Field, Sheet, confirmBox } from '../ui/kit'

export default function Campaign() {
  const s = useApp()
  const role = useRole()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const [editing, setEditing] = useState<WikiPage | null>(null)
  const pages = list('wiki').filter((p) => (cat === 'All' || p.category === cat) && (p.title + ' ' + p.text).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt)
  const me = s.viewer.mode === 'table' ? (s.viewer.id && s.viewer.names[s.viewer.id]) || (role.isDM ? 'DM' : 'Player') : 'Table'
  return (
    <div className="stack">
      <SharedNotes author={me} readOnly={role.readOnly} />
      <div className="row between"><h2>Wiki</h2>{!role.readOnly && <button className="btn primary" onClick={() => setEditing({ id: uid(), title: '', category: 'NPC', text: '', updatedAt: Date.now() })}>＋ Page</button>}</div>
      <input id="wiki-search" placeholder="Search pages" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row">{['All', ...WIKI_CATEGORIES].map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="grid2">
        {pages.map((p) => (
          <article key={p.id} className="card stack" onClick={() => !role.readOnly && setEditing(p)} style={{ cursor: role.readOnly ? 'default' : 'pointer' }}>
            <div className="row between"><h3>{p.title || 'Untitled'}</h3><span className="pill">{p.category}</span></div>
            <p style={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.text}</p>
            <small>{p.author ? `${p.author} · ` : ''}{new Date(p.updatedAt).toLocaleDateString()}{p.sample ? ' · sample' : ''}</small>
          </article>
        ))}
      </div>
      {!pages.length && <Empty>{q ? 'Nothing matches.' : 'No pages yet. NPCs, places, sessions and lore all go here.'}</Empty>}
      {editing && (
        <Sheet title={editing.title || 'New page'} onClose={() => setEditing(null)}>
          <Field label="Title"><input id="wiki-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
          <Field label="Category"><select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as WikiPage['category'] })}>{WIKI_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Text"><textarea id="wiki-text" style={{ minHeight: 200 }} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></Field>
          <div className="row between">
            {list('wiki').some((p) => p.id === editing.id) ? <button className="btn danger" onClick={async () => { if (await confirmBox(`Delete “${editing.title}”?`, 'Delete', true)) { del('wiki', editing.id); setEditing(null) } }}>Delete</button> : <span />}
            <button className="btn primary" onClick={() => { put('wiki', { ...editing, title: editing.title.trim() || 'Untitled', updatedAt: Date.now(), author: me, sample: undefined }); setEditing(null) }}>Save</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/** One shared note everyone can edit. Saves after you stop typing. */
function SharedNotes({ author, readOnly }: { author: string; readOnly: boolean }) {
  const s = useApp()
  const note = s.docs.notes
  const [text, setText] = useState(note.text)
  const dirty = useRef(false)
  const t = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => { if (!dirty.current) setText(note.text) }, [note.text])
  const change = (v: string) => {
    setText(v); dirty.current = true
    clearTimeout(t.current)
    t.current = setTimeout(() => { setDoc('notes', () => ({ text: v, author, updatedAt: Date.now() })); dirty.current = false }, 700)
  }
  return (
    <div className="card stack">
      <div className="row between"><h2>Shared notes</h2><span className="pill">Everyone can edit</span></div>
      <textarea id="shared-notes" style={{ minHeight: 140 }} value={text} disabled={readOnly} onChange={(e) => change(e.target.value)} placeholder="Quest leads, names you'll forget, who owes who…" />
      {note.updatedAt > 0 && <small>Last edit by {note.author || 'Table'} · {new Date(note.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</small>}
    </div>
  )
}
