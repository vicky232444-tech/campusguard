/**
 * CampusGuard simulation & real-time hub (TechTrix'26 Project 8)
 *
 * - Simulates building sensor readings (clearly labelled as simulated in UI)
 * - Simulates security access events for restricted zones
 * - Persists via Next.js internal APIs (single DB writer architecture)
 * - Broadcasts live updates over socket.io on event names:
 *     sensor:tick | alert:new | alert:update | security:event
 *     sos:new | sos:update | maintenance:new | maintenance:update
 *     visitor:update | thresholds:update
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { Server } from 'socket.io'

const PORT = 3003
const NEXT_BASE = process.env.NEXT_BASE || 'http://localhost:3000'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'campusguard-demo-secret'
const TICK_MS = 5000

// ─── Types ────────────────────────────────────────────────────────────────────

type SensorCfg = {
  id: string
  code: string
  name: string
  type: string
  zone: string
  location: string
  unit: string
  minThreshold: number
  maxThreshold: number
  baseline: number
  lastValue: number | null
}

type SimState = {
  value: number
  anomalyTicksLeft: number
  wasAnomaly: boolean
}

// ─── Socket.io hub ────────────────────────────────────────────────────────────

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[sim] client connected: ${socket.id}`)
  socket.on('disconnect', () => console.log(`[sim] client disconnected: ${socket.id}`))
  socket.on('error', (e) => console.error('[sim] socket error', e))
})

// ─── Internal HTTP endpoint: Next.js forwards user actions for live push ─────

const internalServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'POST' && req.url === '/internal/emit') {
    let body = ''
    req.on('data', (c: Buffer) => (body += c))
    req.on('end', () => {
      if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
        res.writeHead(403).end('forbidden')
        return
      }
      try {
        const { kind, payload } = JSON.parse(body)
        io.emit(kind, payload)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400).end('bad request')
      }
    })
    return
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, sensors: simSensors.length, clients: io.engine.clientsCount }))
    return
  }
  res.writeHead(404).end()
})

internalServer.listen(3103, () => console.log('[sim] internal HTTP hub on :3103'))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

async function postToNext(path: string, body: unknown) {
  try {
    const res = await fetch(`${NEXT_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    })
    return await res.json().catch(() => null)
  } catch (e) {
    console.warn(`[sim] postToNext ${path} failed:`, (e as Error).message)
    return null
  }
}

// ─── Sensor simulation ────────────────────────────────────────────────────────

let simSensors: SensorCfg[] = []
const simState = new Map<string, SimState>()

async function bootstrap() {
  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      const res = await fetch(`${NEXT_BASE}/api/internal/state`, {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = (await res.json()) as { sensors: SensorCfg[] }
        simSensors = data.sensors
        for (const s of simSensors) {
          if (!simState.has(s.id)) {
            simState.set(s.id, {
              value: s.lastValue ?? s.baseline,
              anomalyTicksLeft: 0,
              wasAnomaly: false,
            })
          }
        }
        console.log(`[sim] bootstrapped ${simSensors.length} sensors from Next.js`)
        return true
      }
    } catch {
      /* next.js not ready yet */
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return false
}

const noiseAmp = (s: SensorCfg) => Math.max(s.baseline * 0.045, (s.maxThreshold - s.minThreshold) * 0.012)

function nextValue(s: SensorCfg): { value: number; anomaly: boolean } {
  const st = simState.get(s.id)!
  const amp = noiseAmp(s)

  // Mean-reverting random walk
  let value = st.value + (s.baseline - st.value) * 0.18 + rnd(-amp, amp)

  // Random anomaly injection (~1.6% per tick per sensor) that lasts a few ticks
  if (st.anomalyTicksLeft <= 0 && Math.random() < 0.016) {
    st.anomalyTicksLeft = Math.floor(rnd(3, 6))
  }
  if (st.anomalyTicksLeft > 0) {
    st.anomalyTicksLeft--
    const overshoot = rnd(1.15, 1.4)
    // Spike towards the closest limit breach
    const breachHigh = s.baseline + (s.maxThreshold - s.baseline) * 1.4
    const breachLow = s.baseline - (s.baseline - s.minThreshold) * 1.4
    value = Math.random() < 0.5 ? s.baseline + (breachHigh - s.baseline) * overshoot * 0.6 : s.baseline - (s.baseline - breachLow) * overshoot * 0.6
  }

  // Keep inside absolute display bounds (physical values can never be negative)
  const lo = Math.max(0, s.minThreshold - (s.maxThreshold - s.minThreshold) * 0.25)
  const hi = s.maxThreshold + (s.maxThreshold - s.minThreshold) * 0.25
  value = Math.min(Math.max(value, lo), hi)

  st.value = value
  const anomaly = value < s.minThreshold || value > s.maxThreshold
  return { value, anomaly }
}

function severityFor(s: SensorCfg, v: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (v >= s.minThreshold && v <= s.maxThreshold) return 'NORMAL'
  const span = s.maxThreshold - s.minThreshold
  const over = v > s.maxThreshold ? v - s.maxThreshold : s.minThreshold - v
  return over > span * 0.12 ? 'CRITICAL' : 'WARNING'
}

async function sensorTick() {
  if (simSensors.length === 0) return
  const readings = simSensors.map((s) => {
    const { value, anomaly } = nextValue(s)
    const rounded = Math.round(value * 10) / 10
    return { sensor: s, value: rounded, anomaly, severity: severityFor(s, rounded) }
  })

  // 1. Broadcast live tick to all dashboard clients
  io.emit('sensor:tick', {
    ts: new Date().toISOString(),
    readings: readings.map((r) => ({
      sensorId: r.sensor.id,
      code: r.sensor.code,
      value: r.value,
      isAnomaly: r.anomaly,
      severity: r.severity,
    })),
  })

  // 2. Persist batch (single DB writer = Next.js)
  void postToNext('/api/internal/readings', {
    readings: readings.map((r) => ({ sensorId: r.sensor.id, value: r.value, isAnomaly: r.anomaly, status: r.severity })),
  })

  // 3. Raise / auto-resolve anomaly alerts
  for (const r of readings) {
    if (r.anomaly && !simState.get(r.sensor.id)!.wasAnomaly) {
      const sev = r.severity === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM'
      void postToNext('/api/internal/alerts', {
        type: 'SENSOR',
        severity: sev,
        title: `${r.severity === 'CRITICAL' ? 'Critical' : 'Unusual'} reading — ${r.sensor.name}`,
        message: `${r.sensor.code} read ${r.value} ${r.sensor.unit} (safe range ${r.sensor.minThreshold}–${r.sensor.maxThreshold}) at ${r.sensor.zone} · ${r.sensor.location}.`,
        zone: r.sensor.zone,
        sourceType: 'Sensor',
        sourceId: r.sensor.id,
      })
    }
    if (!r.anomaly && simState.get(r.sensor.id)!.wasAnomaly) {
      void postToNext('/api/internal/alerts/auto-resolve', { sourceId: r.sensor.id })
    }
    simState.get(r.sensor.id)!.wasAnomaly = r.anomaly
  }
}

// Periodically refresh config (admin may edit thresholds)
async function refreshConfig() {
  try {
    const res = await fetch(`${NEXT_BASE}/api/internal/state`, {
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = (await res.json()) as { sensors: SensorCfg[] }
      simSensors = data.sensors
    }
  } catch { /* ignore */ }
}

// ─── Security event simulation ────────────────────────────────────────────────

const restrictedAreas = [
  { zone: 'Admin Block', area: 'Server Room' },
  { zone: 'Academic Block B', area: 'Chemistry Lab Store' },
  { zone: 'Admin Block', area: 'Examination Cell' },
  { zone: 'Academic Block A', area: 'Rooftop Access' },
  { zone: 'Main Gate & Perimeter', area: 'Main Gate' },
  { zone: 'Library', area: 'Main Entrance' },
  { zone: 'Utility Block', area: 'Panel Room' },
]

const people = [
  'Priya Nair', 'Aarav Sharma', 'Vikram Singh', 'Meera Krishnan', 'Dr. Anil Rao',
  'Ananya Iyer', 'Rohit Das (Student)', 'Sneha Pillai', 'Ravi Deshpande',
  'Kitchen Staff — Salim', 'Maintenance — Suresh', 'Unknown Person',
]

const normalEvents = ['ACCESS_GRANTED']
const suspiciousEvents = ['ACCESS_DENIED', 'TAILGATING', 'AFTER_HOURS', 'DOOR_HELD_OPEN']

const suspiciousDetails: Record<string, string> = {
  ACCESS_DENIED: 'Credential rejected by access controller',
  TAILGATING: 'Extra person followed through the door',
  AFTER_HOURS: 'Entry attempted outside allowed hours',
  DOOR_HELD_OPEN: 'Door held open longer than permitted',
}

async function securityTick() {
  const area = pick(restrictedAreas)
  const suspicious = Math.random() < 0.3
  const person = suspicious && Math.random() < 0.6 ? 'Unknown Person' : pick(people)
  const eventType = suspicious ? pick(suspiciousEvents) : pick(normalEvents)
  const credential = person === 'Unknown Person' ? pick(['KEYCARD-XXXX', 'KEYCARD-0917', '—']) : `KEYCARD-0${Math.floor(100 + Math.random() * 800)}`

  if (!suspicious) {
    // Normal traffic: persist directly via readings-less endpoint — use alerts route w/o alert
    await postToNext('/api/internal/security-normal', {
      zone: area.zone, area: area.area, personName: person, credential, eventType,
    }).catch(() => null)
    return
  }

  await postToNext('/api/internal/alerts', {
    type: 'SECURITY',
    severity: eventType === 'TAILGATING' || eventType === 'AFTER_HOURS' ? 'HIGH' : 'MEDIUM',
    title: `${eventType.replaceAll('_', ' ')} — ${area.area}`,
    message: `${suspiciousDetails[eventType]} at ${area.zone} · ${area.area} (${person}, ${credential}).`,
    zone: area.zone,
    sourceType: 'SecurityEvent',
    securityEvent: {
      zone: area.zone, area: area.area, personName: person, credential,
      eventType, detail: suspiciousDetails[eventType], isSuspicious: true,
    },
  })
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => console.log(`[sim] socket.io hub running on port ${PORT}`))
void bootstrap().then((ok) => {
  if (!ok) {
    console.error('[sim] could not bootstrap sensors from Next.js — is it running?')
    return
  }
  setInterval(() => void sensorTick(), TICK_MS)
  setInterval(() => void refreshConfig(), 5 * 60 * 1000)
  const scheduleSecurity = () => {
    setTimeout(() => {
      void securityTick().finally(scheduleSecurity)
    }, Math.floor(rnd(18000, 40000)))
  }
  scheduleSecurity()
})

process.on('SIGTERM', () => { httpServer.close(); process.exit(0) })
process.on('SIGINT', () => { httpServer.close(); process.exit(0) })
