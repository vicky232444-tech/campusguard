'use client'

import { create } from 'zustand'
import type { SessionUser } from '@/lib/types'

type UserState = {
  user: SessionUser | null
  hydrated: boolean
  setUser: (u: SessionUser | null) => void
  setHydrated: (v: boolean) => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  hydrated: false,
  setUser: (u) => set({ user: u }),
  setHydrated: (v) => set({ hydrated: v }),
}))
