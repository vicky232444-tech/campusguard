/**
 * Next.js instrumentation — runs once when the server process boots.
 * Starts the watchdog that keeps the socket.io simulation mini-service alive.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSimSupervisor } = await import('./lib/sim-supervisor')
    startSimSupervisor()
  }
}
