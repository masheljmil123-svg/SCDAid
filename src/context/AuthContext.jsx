import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchCurrentUser, logoutCurrentUser } from '../api/scdaidApi.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const payload = await fetchCurrentUser()
      setUser(payload?.authenticated ? payload.user : null)
    } catch {
      setUser(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    try {
      await logoutCurrentUser()
    } catch {
      /* session is cleared locally either way */
    }
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      authenticated: Boolean(user),
      ready,
      refresh,
      signOut,
    }),
    [user, ready, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
