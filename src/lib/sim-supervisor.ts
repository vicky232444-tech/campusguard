/**
 * Supervises the CampusGuard simulation mini-service (mini-services/sim-service).
 *
 * The platform keeps the Next.js server process alive, so we run a lightweight
 * watchdog inside it: every 10 s it checks the sim service health endpoint and
 * respawns `bun --hot index.ts` if the service is down. If the service is
 * already healthy (e.g. started manually), it is adopted instead of duplicated.
 */

const SIM_DIR = 'mini-services/sim-service'
const HEALTH_URL = 'http://127.0.0.1:3003/health'

type SupervisorState = {
  child: ReturnType<typeof import('child_process').spawn> | null
  running: boolean
  attempts: number
  lastSpawnAt: number
}

const globalForSim = globalThis as unknown as { __simSupervisor?: SupervisorState }

async function healthy(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

async function spawnSim(state: SupervisorState) {
  // Backoff: avoid tight spawn loops when the port is held by a dying process
  if (Date.now() - state.lastSpawnAt < 12000) return
  state.lastSpawnAt = Date.now()
  state.attempts += 1

  console.log(`[sim-supervisor] spawning sim service (attempt ${state.attempts})`)
  try {
    const { spawn } = await import('child_process')
    const { mkdirSync, appendFileSync } = await import('fs')
    const { resolve } = await import('path')

    const cwd = resolve(process.cwd(), SIM_DIR)
    mkdirSync(resolve(process.cwd(), '.zscripts'), { recursive: true })

    const bin = process.env.BUN_BIN || (process.execPath && process.execPath.includes('bun') ? process.execPath : 'bun')
    const child = spawn(bin, ['--hot', 'index.ts'], {
      cwd,
      env: { ...process.env, INTERNAL_SECRET: process.env.INTERNAL_SECRET || 'campusguard-demo-secret' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    const logPath = resolve(process.cwd(), '.zscripts', 'mini-service-sim-service.log')
    child.stdout.on('data', (d: Buffer) => {
      try { appendFileSync(logPath, d) } catch { /* ignore */ }
    })
    child.stderr.on('data', (d: Buffer) => {
      try { appendFileSync(logPath, d) } catch { /* ignore */ }
    })
    child.on('error', (err) => {
      console.warn('[sim-supervisor] sim service process error (handled):', err.message)
      if (state.child === child) state.child = null
    })
    child.on('exit', (code) => {
      console.warn(`[sim-supervisor] sim service exited (code ${code}) — watchdog will respawn`)
      if (state.child === child) state.child = null
    })

    state.child = child
  } catch (e) {
    console.error('[sim-supervisor] spawn failed:', (e as Error).message)
  }
}

async function tick(state: SupervisorState) {
  if (await healthy()) {
    state.attempts = 0
    return
  }
  await spawnSim(state)
}

export function startSimSupervisor() {
  if (globalForSim.__simSupervisor?.running) return
  const state: SupervisorState = globalForSim.__simSupervisor ?? {
    child: null,
    running: false,
    attempts: 0,
    lastSpawnAt: 0,
  }
  state.running = true
  globalForSim.__simSupervisor = state

  console.log('[sim-supervisor] watchdog started')
  const loop = async () => {
    if (!globalForSim.__simSupervisor?.running) return
    try {
      await tick(state)
    } catch {
      /* keep watching */
    }
    setTimeout(() => void loop(), 10000)
  }
  void loop()
}
