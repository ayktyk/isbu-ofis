import { get, set, del } from 'idb-keyval'
import type { Query } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { getAccessToken } from './authTokens'

export function cacheOwner(): string | null {
  try {
    const token = getAccessToken()
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.userId === 'string' ? payload.userId : null
  } catch { return null }
}
function belongsTo(client: PersistedClient, owner: string) {
  const auth = client.clientState.queries.find(q => q.queryKey[0] === 'auth' && q.queryKey[1] === 'me')
  return (auth?.state.data as { id?: string } | undefined)?.id === owner
}
export const queryPersister: Persister = {
  persistClient: async client => {
    const owner = cacheOwner()
    if (!owner || !belongsTo(client, owner)) return
    try { await set(`themis:query:${owner}`, client) } catch {}
  },
  restoreClient: async () => {
    const owner = cacheOwner()
    if (!owner) return undefined
    try {
      const client = await get<PersistedClient>(`themis:query:${owner}`)
      return cacheOwner() === owner && client && belongsTo(client, owner) ? client : undefined
    } catch { return undefined }
  },
  removeClient: async () => {
    const owner = cacheOwner()
    if (owner) { try { await del(`themis:query:${owner}`) } catch {} }
  },
}
const roots = new Set(['auth', 'dashboard', 'tasks', 'cases', 'clients', 'notifications', 'collections', 'hearings'])
export function shouldPersistQuery(query: Query): boolean {
  return typeof query.queryKey[0] === 'string' && roots.has(query.queryKey[0]) && query.state.status === 'success'
}
