'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'
import { useLiveStore } from '@/lib/live-store'
import { beep, playEmergencySiren30Sec } from '@/lib/beep'
import type { Alert, LiveTick, SecurityEvent, SosAlert } from '@/lib/types'

/**
 * Subscribes to all live simulation + user-action events over socket.io.
 * Updates the live sensor store, invalidates queries, raises toasts & beeps.
 */
export function useLiveEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    const store = useLiveStore.getState()

    socket.on('connect', () => {
      useLiveStore.getState().setConnection('connected')
    })
    socket.on('disconnect', () => {
      useLiveStore.getState().setConnection('disconnected')
    })
    socket.on('connect_error', () => {
      useLiveStore.getState().setConnection('disconnected')
    })

    socket.on('sensor:tick', (tick: LiveTick) => {
      useLiveStore.getState().applyTick(tick)
    })

    socket.on('alert:new', (payload: { alert: Alert }) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const a = payload.alert
      const { soundEnabled, flashCritical } = useLiveStore.getState()
      if (a.severity === 'CRITICAL') {
        flashCritical()
        if (soundEnabled) beep('critical')
        toast.error(a.title, { description: a.message, duration: 10000 })
      } else if (a.severity === 'HIGH') {
        if (soundEnabled) beep('info')
        toast.warning(a.title, { description: a.message, duration: 8000 })
      } else {
        toast.info(a.title, { description: a.message, duration: 6000 })
      }
    })

    socket.on('alert:update', () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    socket.on('security:event', (payload: { event: SecurityEvent }) => {
      queryClient.invalidateQueries({ queryKey: ['security-events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (payload.event.isSuspicious) {
        toast.warning('Suspicious activity detected', {
          description: `${payload.event.eventType.replaceAll('_', ' ')} — ${payload.event.area} (${payload.event.zone})`,
          duration: 8000,
        })
      }
    })

    socket.on('sos:new', (payload: { sos: SosAlert; alert?: Alert; isMassBroadcast?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['sos-requests'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const { soundEnabled, flashCritical } = useLiveStore.getState()
      flashCritical()

      if (payload.isMassBroadcast) {
        // Broadcast to ALL devices: trigger continuous 30-second siren!
        playEmergencySiren30Sec()
        toast.error(`🚨 CAMPUS-WIDE EMERGENCY EVACUATION`, {
          description: `Administrator authorized broadcast: ${payload.sos.message || payload.sos.emergencyType} (${payload.sos.locationText || 'All Zones'})`,
          duration: 30000,
        })
      } else {
        if (soundEnabled) beep('critical')
        toast.error(`🚨 Personal SOS — ${payload.sos.emergencyType.replaceAll('_', ' ')}`, {
          description: `${payload.sos.triggeredBy} (${payload.sos.role})${payload.sos.locationText ? ` · ${payload.sos.locationText}` : ''}`,
          duration: 12000,
        })
      }
    })

    socket.on('sos:update', () => {
      queryClient.invalidateQueries({ queryKey: ['sos'] })
      queryClient.invalidateQueries({ queryKey: ['sos-requests'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    socket.on('maintenance:new', () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    socket.on('maintenance:update', () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['fines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    socket.on('visitor:update', () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    })

    socket.on('thresholds:update', () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
    })

    // If already connected before listeners attached (fast reconnect)
    if (socket.connected) store.setConnection('connected')

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('sensor:tick')
      socket.off('alert:new')
      socket.off('alert:update')
      socket.off('security:event')
      socket.off('sos:new')
      socket.off('sos:update')
      socket.off('maintenance:new')
      socket.off('maintenance:update')
      socket.off('visitor:update')
      socket.off('thresholds:update')
    }
  }, [queryClient])
}
