// Who is holding this phone, and what they may do.
import { useEffect } from 'react'
import type { Character } from './types'
import { list, resolveNames, useApp, type State } from './store'
import { charLabel } from '../rules/character'

export function roleOf(s: State) {
  const table = s.viewer.mode === 'table'
  const isDM = table ? s.viewer.isOwner && s.local.role === 'dm' : s.local.role === 'dm'
  const readOnly = !s.viewer.canWrite
  const mine = (c: Character) => (isDM ? true : table ? !!s.viewer.id && c.ownerId === s.viewer.id : s.local.playerChars.includes(c.id))
  return { isDM, readOnly, table, mine, canEdit: (c: Character) => !readOnly && (isDM || mine(c)) }
}

export function useRole() {
  const s = useApp()
  return roleOf(s)
}

/** "Character (Player)". Online: the claude.ai name of whoever plays it. Offline: the typed player name. */
export function usePlayerLabel() {
  const s = useApp()
  const owners = list('chars').map((c) => c.ownerId).filter(Boolean) as string[]
  const key = owners.join(',')
  useEffect(() => { if (s.viewer.mode === 'table') resolveNames(key ? key.split(',') : []) }, [key, s.viewer.mode])
  return (c?: Character, fallback = '') => {
    if (!c) return fallback
    const player = s.viewer.mode === 'table' && c.ownerId ? s.viewer.names[c.ownerId] || c.playerName : c.playerName
    return charLabel(c.name, player)
  }
}
