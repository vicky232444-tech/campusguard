'use client'

import { create } from 'zustand'

export type LiveReading = {
  sensorId: string
  code: string
  value: number
  isAnomaly: boolean
  severity: 'NORMAL' | 'WARNING' | 'CRITICAL'
  ts: string
}

type LiveState = {
  connection: 'connecting' | 'connected' | 'disconnected'
  readings: Record<string, LiveReading>
  lastTickAt: string | null
  criticalFlashAt: number | null
  soundEnabled: boolean
  setConnection: (c: LiveState['connection']) => void
  applyTick: (tick: { ts: string; readings: Omit<LiveReading, 'ts'>[] }) => void
  flashCritical: () => void
  toggleSound: () => void
}

export const useLiveStore = create<LiveState>((set) => ({
  connection: 'connecting',
  readings: {},
  lastTickAt: null,
  criticalFlashAt: null,
  soundEnabled: typeof window !== 'undefined' ? localStorage.getItem('cg-sound') !== 'off' : true,
  setConnection: (connection) => set({ connection }),
  applyTick: (tick) =>
    set((s) => {
      const next = { ...s.readings }
      for (const r of tick.readings) next[r.sensorId] = { ...r, ts: tick.ts }
      return { readings: next, lastTickAt: tick.ts }
    }),
  flashCritical: () => set({ criticalFlashAt: Date.now() }),
  toggleSound: () =>
    set((s) => {
      const soundEnabled = !s.soundEnabled
      localStorage.setItem('cg-sound', soundEnabled ? 'on' : 'off')
      return { soundEnabled }
    }),
}))
