'use client'

import { io, type Socket } from 'socket.io-client'

/**
 * Singleton socket.io client for live updates from the simulation service.
 * Never use a port in the URL — the gateway routes via XTransformPort.
 */
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
