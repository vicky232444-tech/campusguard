'use client'

import { useEffect } from 'react'
import { useUserStore } from '@/lib/user-store'
import { loadSession } from '@/lib/api'
import { disconnectSocket } from '@/lib/socket'
import { LoginScreen } from '@/components/login-screen'
import { AppShell } from '@/components/app-shell'

export default function Page() {
  const user = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)
  const hydrated = useUserStore((s) => s.hydrated)
  const setHydrated = useUserStore((s) => s.setHydrated)

  useEffect(() => {
    const session = loadSession()
    if (session) setUser(session)
    setHydrated(true)
    return () => disconnectSocket()
  }, [setUser, setHydrated])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return user ? <AppShell /> : <LoginScreen />
}
