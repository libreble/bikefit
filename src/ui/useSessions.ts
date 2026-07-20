/** Fetch the stored sessions (newest first) with a manual refresh — shared by the history page and
 * the live page's "recent rides" panel. Persistence stays behind the controller. */
import { useCallback, useEffect, useState } from 'react'
import * as controller from '../app/controller'
import type { StoredSession } from '../session/db'

export interface UseSessions {
  sessions: StoredSession[]
  loading: boolean
  error: string | undefined
  refresh: () => Promise<void>
}

export function useSessions(): UseSessions {
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      setSessions(await controller.listPastSessions())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { sessions, loading, error, refresh }
}
