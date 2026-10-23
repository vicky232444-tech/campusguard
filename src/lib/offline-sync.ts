'use client'

import { create } from 'zustand'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export type OfflineSosItem = {
  id: string
  emergencyType: string
  message?: string
  shareLocation?: boolean
  latitude?: number | null
  longitude?: number | null
  locationText?: string
  timestamp: number
}

export type OfflineReportItem = {
  id: string
  category: string
  title: string
  description: string
  zone: string
  location?: string
  priority: string
  photoData?: string | null
  timestamp: number
}

interface OfflineStore {
  isOnline: boolean
  sosQueue: OfflineSosItem[]
  reportQueue: OfflineReportItem[]
  setOnline: (status: boolean) => void
  addOfflineSos: (item: Omit<OfflineSosItem, 'id' | 'timestamp'>) => OfflineSosItem
  addOfflineReport: (item: Omit<OfflineReportItem, 'id' | 'timestamp'>) => OfflineReportItem
  syncAll: () => Promise<void>
}

const STORAGE_KEY_SOS = 'campusguard_offline_sos'
const STORAGE_KEY_REPORTS = 'campusguard_offline_reports'

function loadFromStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // storage quota or disabled
  }
}

export const useOfflineSync = create<OfflineStore>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  sosQueue: loadFromStorage<OfflineSosItem>(STORAGE_KEY_SOS),
  reportQueue: loadFromStorage<OfflineReportItem>(STORAGE_KEY_REPORTS),

  setOnline: (isOnline) => {
    set({ isOnline })
    if (isOnline) {
      void get().syncAll()
    }
  },

  addOfflineSos: (data) => {
    const item: OfflineSosItem = {
      ...data,
      id: `offline-sos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    }
    const updated = [item, ...get().sosQueue]
    set({ sosQueue: updated })
    saveToStorage(STORAGE_KEY_SOS, updated)
    return item
  },

  addOfflineReport: (data) => {
    const item: OfflineReportItem = {
      ...data,
      id: `offline-rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    }
    const updated = [item, ...get().reportQueue]
    set({ reportQueue: updated })
    saveToStorage(STORAGE_KEY_REPORTS, updated)
    return item
  },

  syncAll: async () => {
    const { sosQueue, reportQueue } = get()
    if (!sosQueue.length && !reportQueue.length) return

    let syncedCount = 0

    // Sync SOS
    const remainingSos: OfflineSosItem[] = []
    for (const item of sosQueue) {
      try {
        await api('/api/sos', {
          method: 'POST',
          json: {
            emergencyType: item.emergencyType,
            message: `[OFFLINE SYNCED] ${item.message || ''}`.trim(),
            shareLocation: item.shareLocation,
            latitude: item.latitude,
            longitude: item.longitude,
            locationText: item.locationText,
          },
        })
        syncedCount++
      } catch {
        remainingSos.push(item)
      }
    }

    // Sync Reports
    const remainingReports: OfflineReportItem[] = []
    for (const item of reportQueue) {
      try {
        await api('/api/maintenance', {
          method: 'POST',
          json: {
            category: item.category,
            title: item.title,
            description: `[OFFLINE SYNCED] ${item.description}`,
            zone: item.zone,
            location: item.location,
            priority: item.priority,
            photoData: item.photoData,
          },
        })
        syncedCount++
      } catch {
        remainingReports.push(item)
      }
    }

    set({ sosQueue: remainingSos, reportQueue: remainingReports })
    saveToStorage(STORAGE_KEY_SOS, remainingSos)
    saveToStorage(STORAGE_KEY_REPORTS, remainingReports)

    if (syncedCount > 0) {
      toast.success(`Network restored: ${syncedCount} offline items synchronized successfully!`)
    }
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useOfflineSync.getState().setOnline(true))
  window.addEventListener('offline', () => useOfflineSync.getState().setOnline(false))
}
