// Online play through Supabase. The official supabase-js client is loaded from a CDN the first time
// someone goes online (pinned version), so the offline app stays small and works without it.
export const SUPABASE_URL = 'https://xfnsrooeaniyzxszfakz.supabase.co'
// Public anon key: safe to ship — row-level security in supabase/lorekeep.sql decides who can read and write.
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbnNyb29lYW5peXp4c3pmYWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MjQ0OTAsImV4cCI6MjEwODAwMDQ5MH0.5zVqlAEB6TOhk92hO4P_FR_8eYz0NFaf-ACB7WYMdds'
const LIB = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
]
export const CAMPAIGN_KEY = 'lorekeep.campaign'
export const JOIN_KEY = 'lorekeep.pendingJoin'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Sb = any
export interface Campaign { id: string; name: string; code: string; role: 'dm' | 'player'; display_name: string }

let client: Sb | null = null
let loading: Promise<Sb> | null = null

function inject(src: string) {
  return new Promise<void>((ok, bad) => {
    const s = document.createElement('script')
    s.src = src; s.async = true; s.crossOrigin = 'anonymous'
    s.onload = () => ok(); s.onerror = () => { s.remove(); bad(new Error('load failed')) }
    document.head.appendChild(s)
  })
}

export function getClient(): Promise<Sb> {
  if (client) return Promise.resolve(client)
  if (!loading) {
    loading = (async () => {
      const w = window as any
      if (!w.supabase?.createClient) {
        let ok = false
        for (const src of LIB) { try { await inject(src); ok = true; break } catch { /* try the next CDN */ } }
        if (!ok || !w.supabase?.createClient) throw new Error('Could not reach the online service. Check your connection and try again.')
      }
      client = w.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'lorekeep-auth' },
        realtime: { params: { eventsPerSecond: 20 } },
      })
      return client
    })()
    loading.catch(() => { loading = null })
  }
  return loading
}

/** True when a sign-in is saved on this device or the URL is a sign-in link — worth loading the client for. */
export function mightBeSignedIn() {
  try { return !!localStorage.getItem('lorekeep-auth') || /access_token=|error_description=/.test(location.hash) } catch { return false }
}

const err = (e: any) => new Error(e?.message || String(e))

export async function currentUser(): Promise<{ id: string; email?: string } | null> {
  const sb = await getClient()
  const { data } = await sb.auth.getSession()
  return data?.session?.user ?? null
}
export const redirectUrl = () => location.origin + location.pathname

export async function sendMagicLink(email: string) {
  const sb = await getClient()
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } })
  if (error) throw err(error)
}
export async function signInPassword(email: string, password: string) {
  const sb = await getClient()
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw err(error)
}
export async function signUpPassword(email: string, password: string): Promise<'signed-in' | 'check-email'> {
  const sb = await getClient()
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl() } })
  if (error) throw err(error)
  return data?.session ? 'signed-in' : 'check-email'
}
export async function signOut() {
  const sb = await getClient()
  await sb.auth.signOut()
}

export async function myCampaigns(userId: string): Promise<Campaign[]> {
  const sb = await getClient()
  const { data, error } = await sb.from('lk_members').select('role, display_name, lk_campaigns(id, name, code)').eq('user_id', userId)
  if (error) throw err(error)
  return (data ?? []).filter((r: any) => r.lk_campaigns).map((r: any) => ({ ...r.lk_campaigns, role: r.role, display_name: r.display_name }))
}
export async function createCampaign(name: string, displayName: string): Promise<{ id: string; code: string; name: string }> {
  const sb = await getClient()
  const { data, error } = await sb.rpc('lk_create_campaign', { p_name: name, p_display_name: displayName })
  if (error) throw err(error)
  return data
}
export async function joinCampaign(code: string, displayName: string): Promise<{ id: string; code: string; name: string }> {
  const sb = await getClient()
  const { data, error } = await sb.rpc('lk_join_campaign', { p_code: code, p_display_name: displayName })
  if (error) throw err(error)
  return data
}
export async function leaveCampaign(campaignId: string, userId: string) {
  const sb = await getClient()
  const { error } = await sb.from('lk_members').delete().match({ campaign_id: campaignId, user_id: userId })
  if (error) throw err(error)
}
export async function deleteAccount() {
  const sb = await getClient()
  const { error } = await sb.rpc('lk_delete_my_account')
  if (error) throw err(error)
  await sb.auth.signOut()
}
export const inviteLink = (code: string) => `${redirectUrl()}#join=${code}`
