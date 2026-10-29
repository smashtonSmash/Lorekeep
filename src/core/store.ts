// One store for the whole app. Two backends behind the same API:
//  • local  — this device only (localStorage)
//  • table  — the artifact's shared database: every phone at the table sees the same campaign live.
import { useSyncExternalStore } from 'react'
import type { Character, Chest, DiceRoll, Encounter, RecapEvent, Settings, SharedNote, Town, Trade, WikiPage } from './types'
import { uid } from './types'
import type { CustomOrigin } from '../data/origins'
import { DEFAULT_MERCHANTS } from '../rules/economy'
import type { CasinoState, Seat } from '../screens/casinoState'

export interface Docs {
  encounter: Encounter
  town: Town
  notes: SharedNote
  recap: { events: RecapEvent[] }
  settings: Settings
  casino: CasinoState
  library: { items: CustomOrigin[] }
}
export interface Cols { chars: Character; chests: Chest; wiki: WikiPage; trades: Trade; seats: Seat }
export type ColName = keyof Cols
export interface Local { dice: DiceRoll[]; tab: string; role: 'dm' | 'player'; playerChars: string[]; quickAttack: boolean; dmPeekFountain?: boolean }

export interface Viewer { mode: 'local' | 'table'; canWrite: boolean; isOwner: boolean; id: string | null; names: Record<string, string> }

export interface State {
  ready: boolean
  docs: Docs
  cols: { [K in ColName]: Record<string, Cols[K]> }
  local: Local
  viewer: Viewer
  error?: string
}

export const emptyEncounter = (): Encounter => ({ combatants: [], round: 1, turnId: null, log: [], pendingLoot: [] })
export const defaultTown = (): Town => ({
  places: [{ id: 'crossroads', name: 'Crossroads', hasFountain: true }], currentId: 'crossroads', merchants: DEFAULT_MERCHANTS,
  fountain: { silver: 0, threshold: null }, vault: { slots: 10, blocks: 0, items: [] }, stash: { on: false, gold: 0, silver: 0, items: [] },
})
const defaults = (): Docs => ({
  encounter: emptyEncounter(), town: defaultTown(), notes: { text: '', updatedAt: 0 }, recap: { events: [] },
  settings: { originBudget: 3, allowReroll: true, showSamples: true },
  casino: { open: false, game: 'blackjack', round: null, deck: [], handNo: 0 }, library: { items: [] },
})
const COLS: ColName[] = ['chars', 'chests', 'wiki', 'trades', 'seats']
const LOCAL_KEY = 'lorekeep.local'
const DATA_KEY = 'lorekeep.data.'

const safeGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const safeSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* private mode */ } }
const parse = <T,>(s: string | null, fb: T): T => { try { return s ? (JSON.parse(s) as T) : fb } catch { return fb } }

const localDefaults: Local = { dice: [], tab: 'battle', role: 'dm', playerChars: [], quickAttack: true }
let state: State = {
  ready: false, docs: defaults(), cols: { chars: {}, chests: {}, wiki: {}, trades: {}, seats: {} },
  local: { ...localDefaults, ...parse(safeGet(LOCAL_KEY), {}) },
  viewer: { mode: 'local', canWrite: true, isOwner: true, id: null, names: {} },
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l) }
export const getState = () => state
export function useApp(): State { return useSyncExternalStore(subscribe, getState) }

// ---------- backends ----------
type Path = string // 'table/encounter' | 'chars/<id>'
interface Backend { write(path: Path, body: Record<string, unknown> | null): Promise<void> }

const localBackend: Backend = {
  async write(path, body) { safeSet(DATA_KEY + path, body ? JSON.stringify(body) : null) },
}
let backend: Backend = localBackend

function loadLocal() {
  const docs = defaults()
  for (const k of Object.keys(docs) as (keyof Docs)[]) {
    const v = parse<{ v: unknown } | null>(safeGet(DATA_KEY + 'table/' + k), null)
    if (v) (docs as unknown as Record<string, unknown>)[k] = { ...(docs[k] as object), ...(v.v as object) }
  }
  const cols = { chars: {}, chests: {}, wiki: {}, trades: {}, seats: {} } as State['cols']
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!
      if (!key.startsWith(DATA_KEY)) continue
      const [col, id] = key.slice(DATA_KEY.length).split('/')
      if ((COLS as string[]).includes(col)) (cols[col as ColName] as Record<string, unknown>)[id] = parse(safeGet(key), null)
    }
  } catch { /* no storage */ }
  return { docs, cols }
}

// Writes are coalesced per document: one in flight at a time, newest value wins.
const pending = new Map<Path, Record<string, unknown> | null>()
const inflight = new Set<Path>()
const timers = new Map<Path, ReturnType<typeof setTimeout>>()
function queueWrite(path: Path, body: Record<string, unknown> | null, delay = 250) {
  pending.set(path, body)
  clearTimeout(timers.get(path))
  timers.set(path, setTimeout(() => flush(path), state.viewer.mode === 'local' ? 0 : delay))
}
async function flush(path: Path) {
  if (inflight.has(path) || !pending.has(path)) return
  const body = pending.get(path)!
  pending.delete(path)
  inflight.add(path)
  try { await backend.write(path, body) }
  catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'invalid_argument' || code === 'not_granted') { state = { ...state, viewer: { ...state.viewer, canWrite: false } }; emit() }
    else if (code === 'quota_exceeded') { state = { ...state, error: 'The table database is full. Delete old chests or wiki pages.' }; emit() }
    else { pending.has(path) || pending.set(path, body); setTimeout(() => flush(path), 1500 + Math.random() * 1000) }
  } finally {
    inflight.delete(path)
    if (pending.has(path)) flush(path)
  }
}
const busy = (path: Path) => pending.has(path) || inflight.has(path)

// ---------- public actions ----------
export function setDoc<K extends keyof Docs>(key: K, fn: (d: Docs[K]) => Docs[K]) {
  const prev = state.docs[key]
  const next = fn(prev)
  if (next === prev) return
  state = { ...state, docs: { ...state.docs, [key]: next } }
  emit()
  queueWrite('table/' + key, { v: next as unknown })
}
export function put<K extends ColName>(col: K, item: Cols[K] & { id: string }) {
  state = { ...state, cols: { ...state.cols, [col]: { ...state.cols[col], [item.id]: item } } }
  emit()
  queueWrite(`${col}/${item.id}`, item as unknown as Record<string, unknown>)
}
export function patch<K extends ColName>(col: K, id: string, fn: (x: Cols[K]) => Cols[K]) {
  const cur = state.cols[col][id]
  if (!cur) return
  const next = fn(cur)
  if (next !== cur) put(col, next as Cols[K] & { id: string })
}
export function del(col: ColName, id: string) {
  const { [id]: _gone, ...rest } = state.cols[col] as Record<string, unknown>
  void _gone
  state = { ...state, cols: { ...state.cols, [col]: rest } }
  emit()
  queueWrite(`${col}/${id}`, null)
}
export function setLocal(fn: (l: Local) => Local) {
  state = { ...state, local: fn(state.local) }
  safeSet(LOCAL_KEY, JSON.stringify(state.local))
  emit()
}
export const list = <K extends ColName>(col: K): Cols[K][] => Object.values(state.cols[col]) as Cols[K][]

// ---------- start ----------
interface DbSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface DbQuerySnap { docs: DbSnap[] }
interface DbRef { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void>; get(): Promise<DbSnap> }
interface DbCol { doc(id: string): DbRef; get(): Promise<DbQuerySnap>; onSnapshot(n: (s: DbQuerySnap) => void, e?: (e: { code: string }) => void): () => void }
interface Db { doc(p: string): DbRef; collection(p: string): DbCol }
interface UserCap { isOwner(): boolean; canEdit(): boolean; can(n: string): boolean | null; id(): Promise<string | null>; profiles(ids: string[]): Promise<Record<string, { name: string }>> }
declare global { interface Window { claude?: { use(name: string): Promise<unknown> } } }

let userCap: UserCap | null = null

export async function start(seed: () => { chars: Character[]; wiki: WikiPage[]; encounter: Encounter }) {
  const local = loadLocal()
  const firstRun = safeGet(DATA_KEY + 'seeded') === null && Object.keys(local.cols.chars).length === 0
  state = { ...state, docs: local.docs, cols: local.cols }
  // Are we inside a claude.ai artifact with a shared database?
  let db: Db | null = null
  if (window.claude?.use) {
    try { [db, userCap] = (await Promise.all([window.claude.use('db'), window.claude.use('user')])) as [Db | null, UserCap | null] } catch { db = null }
  }
  if (!db) {
    if (firstRun) {
      const s = seed()
      safeSet(DATA_KEY + 'seeded', '1')
      state = { ...state, ready: true }
      s.chars.forEach((c) => put('chars', c)); s.wiki.forEach((w) => put('wiki', w)); setDoc('encounter', () => s.encounter)
    }
    state = { ...state, ready: true }
    emit()
    return
  }
  // ---- table mode ----
  const id = userCap ? await userCap.id().catch(() => null) : null
  const isOwner = userCap?.isOwner() ?? false
  const can = userCap?.can('data.write')
  state = { ...state, docs: defaults(), cols: { chars: {}, chests: {}, wiki: {}, trades: {}, seats: {} }, viewer: { mode: 'table', isOwner, canWrite: can !== false, id, names: {} }, local: { ...state.local, role: isOwner ? state.local.role : 'player' } }
  backend = {
    async write(path, body) {
      const ref = db!.doc(path)
      if (body) await ref.set(JSON.parse(JSON.stringify(body))); else await ref.delete()
    },
  }
  const onErr = (e: { code: string }) => { if (e.code === 'revoked') { state = { ...state, viewer: { ...state.viewer, canWrite: false }, error: 'Access to the table changed. Reload the page.' }; emit() } }
  let pendingReady = 1 + COLS.length
  const markReady = () => { if (--pendingReady === 0) { state = { ...state, ready: true }; emit() } }
  let first = true
  db.collection('table').onSnapshot((snap) => {
    const docs = { ...state.docs }
    const base = defaults()
    for (const d of snap.docs) {
      const k = d.id as keyof Docs
      if (!(k in base) || busy('table/' + k)) continue
      const v = d.data()?.v
      ;(docs as unknown as Record<string, unknown>)[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(base[k] as object), ...(v as object) } : v ?? base[k]
    }
    state = { ...state, docs }
    emit()
    if (first) { first = false; markReady() }
  }, onErr)
  for (const col of COLS) {
    let firstCol = true
    db.collection(col).onSnapshot((snap) => {
      const next: Record<string, unknown> = {}
      for (const d of snap.docs) next[d.id] = d.data()
      // keep our own unsent edits
      for (const [id, v] of Object.entries(state.cols[col])) if (busy(`${col}/${id}`)) next[id] = v
      for (const p of pending.keys()) if (p.startsWith(col + '/') && pending.get(p) === null) delete next[p.slice(col.length + 1)]
      state = { ...state, cols: { ...state.cols, [col]: next } }
      emit()
      if (firstCol) { firstCol = false; markReady() }
    }, onErr)
  }
}

/** Player names from claude.ai profiles (online). Never stored — resolved fresh. */
export async function resolveNames(ids: string[]) {
  if (!userCap || !ids.length) return
  const missing = ids.filter((i) => !(i in state.viewer.names))
  if (!missing.length) return
  try {
    const ps = await userCap.profiles(missing)
    const names = { ...state.viewer.names }
    for (const i of missing) names[i] = ps[i]?.name || ''
    state = { ...state, viewer: { ...state.viewer, names } }
    emit()
  } catch { /* names stay blank */ }
}

/** Copy this device's local campaign up to the shared table. */
export function uploadLocalToTable() {
  const local = loadLocal()
  for (const col of COLS) for (const v of Object.values(local.cols[col])) put(col, v as never)
  for (const k of Object.keys(local.docs) as (keyof Docs)[]) setDoc(k, () => local.docs[k] as never)
}
export const hasLocalData = () => Object.keys(loadLocal().cols.chars).length > 0

export function exportAll(): string {
  return JSON.stringify({ app: 'lorekeep', v: 1, docs: state.docs, cols: state.cols }, null, 1)
}
export function importAll(json: string) {
  const d = JSON.parse(json)
  if (d.app !== 'lorekeep') throw new Error('Not a LoreKeep backup')
  for (const col of COLS) for (const v of Object.values(d.cols?.[col] ?? {})) put(col, v as never)
  for (const k of Object.keys(defaults()) as (keyof Docs)[]) if (d.docs?.[k]) setDoc(k, () => d.docs[k])
}

export const newId = uid
