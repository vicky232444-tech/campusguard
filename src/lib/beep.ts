'use client'

/** Short attention beep for CRITICAL events (WebAudio, no assets). */
let ctx: AudioContext | null = null

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

/** tone: 'critical' = two urgent beeps, 'info' = single soft ping */
export function beep(tone: 'critical' | 'info' = 'info') {
  const c = getCtx()
  if (!c) return
  const play = (freq: number, start: number, dur: number) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02)
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
