/**
 * Server-side helper: forwards "user action" events to the simulation /
 * socket.io mini-service (port 3003) so every connected client receives
 * live updates instantly. Fire-and-forget — API responses never fail
 * because of broadcast issues.
 */

const SIM_SERVICE_URL = process.env.SIM_SERVICE_URL || 'http://localhost:3003'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'campusguard-demo-secret'

export type BroadcastEvent = {
  kind:
    | 'sos:new'
    | 'sos:update'
    | 'maintenance:new'
    | 'maintenance:update'
    | 'visitor:update'
    | 'alert:new'
    | 'alert:update'
    | 'thresholds:update'
    | 'security:event'
    | 'ping'
  payload?: unknown
}

export async function broadcast(event: BroadcastEvent) {
  try {
    await fetch(`${SIM_SERVICE_URL}/internal/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(2500),
    })
  } catch {
    // Non-fatal: clients also refetch on focus/reconnect.
    console.warn(`[broadcast] could not reach sim service for ${event.kind}`)
  }
}

export function assertInternalSecret(req: Request): boolean {
  return req.headers.get('x-internal-secret') === INTERNAL_SECRET
}
