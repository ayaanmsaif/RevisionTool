import confetti from 'canvas-confetti'

const COLORS = ['#3358f0', '#1fae62', '#f2a516', '#ff7a1a', '#ec4359', '#22b8cf']

let fire: confetti.CreateTypes | null = null

function launcher(): confetti.CreateTypes {
  if (fire) return fire
  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:var(--z-confetti)'
  document.body.appendChild(canvas)
  fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true })
  return fire
}

export function celebrate(big = false): void {
  const f = launcher()
  const base = { colors: COLORS, ticks: 220, gravity: 1.05, scalar: 1.05 }
  void f({
    ...base,
    particleCount: big ? 140 : 70,
    spread: 75,
    startVelocity: 48,
    origin: { x: 0.5, y: 0.65 }
  })
  if (big) {
    window.setTimeout(() => {
      void f({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } })
      void f({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } })
    }, 180)
  }
}
