'use client'

/** WebAudio synthesizer for alerts and 30-second continuous emergency siren */
let ctx: AudioContext | null = null
let activeSirenStop: (() => void) | null = null
let sirenListeners: Set<(active: boolean, remainingSec: number) => void> = new Set()

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx.state === 'running' ? ctx : null
  } catch {
    return null
  }
}

export function subscribeSiren(listener: (active: boolean, remainingSec: number) => void) {
  sirenListeners.add(listener)
  return () => { sirenListeners.delete(listener) }
}

function notifySiren(active: boolean, remaining: number) {
  sirenListeners.forEach((l) => l(active, remaining))
}

/** Short attention beep for UI events */
export function beep(tone: 'critical' | 'info' = 'info') {
  const c = getCtx()
  if (!c) return
  const play = (freq: number, start: number, dur: number) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain).connect(c.destination)
    osc.start(start)
    osc.stop(start + dur + 0.05)
  }
  const t = c.currentTime
  if (tone === 'critical') {
    play(880, t, 0.18)
    play(880, t + 0.28, 0.18)
  } else {
    play(620, t, 0.14)
  }
}

/**
 * Continuous 30-second emergency siren.
 * Wails back and forth between 600Hz and 1300Hz with dual harmonic oscillators.
 * Pehle 10s tha, ab strictly continuous 30s as requested by user.
 */
export function playEmergencySiren30Sec(): () => void {
  // If an existing siren is running, stop it first
  if (activeSirenStop) {
    activeSirenStop()
  }

  const c = getCtx()
  if (!c) return () => {}

  const TOTAL_DURATION_SEC = 30
  let isRunning = true

  // Master gain
  const masterGain = c.createGain()
  masterGain.gain.setValueAtTime(0.001, c.currentTime)
  masterGain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.1)
  masterGain.connect(c.destination)

  // Primary tone oscillator
  const osc1 = c.createOscillator()
  osc1.type = 'sawtooth'

  // Harmonic tone oscillator
  const osc2 = c.createOscillator()
  osc2.type = 'triangle'

  // Low frequency oscillator (LFO) to modulate pitch up & down smoothly
  const lfo = c.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(0.65, c.currentTime) // Wails every ~1.5s

  const lfoGain = c.createGain()
  lfoGain.gain.setValueAtTime(350, c.currentTime) // Frequency deviation +/- 350Hz

  // Base frequencies
  osc1.frequency.setValueAtTime(850, c.currentTime)
  osc2.frequency.setValueAtTime(1150, c.currentTime)

  lfo.connect(lfoGain)
  lfoGain.connect(osc1.frequency)
  lfoGain.connect(osc2.frequency)

  osc1.connect(masterGain)
  osc2.connect(masterGain)

  const startTime = c.currentTime
  osc1.start(startTime)
  osc2.start(startTime)
  lfo.start(startTime)

  let remaining = TOTAL_DURATION_SEC
  notifySiren(true, remaining)

  const intervalId = setInterval(() => {
    remaining -= 1
    if (remaining <= 0) {
      stop()
    } else {
      notifySiren(true, remaining)
    }
  }, 1000)

  const stop = () => {
    if (!isRunning) return
    isRunning = false
    clearInterval(intervalId)
    notifySiren(false, 0)

    try {
      masterGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15)
      setTimeout(() => {
        try {
          osc1.stop()
          osc2.stop()
          lfo.stop()
          osc1.disconnect()
          osc2.disconnect()
          lfo.disconnect()
          masterGain.disconnect()
        } catch {
          // ignore cleanup errors
        }
      }, 200)
    } catch {
      // ignore
    }

    if (activeSirenStop === stop) {
      activeSirenStop = null
    }
  }

  activeSirenStop = stop
  return stop
}

export function stopEmergencySiren() {
  if (activeSirenStop) {
    activeSirenStop()
    activeSirenStop = null
  }
}
