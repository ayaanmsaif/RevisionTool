// Synthesised sound effects (Web Audio). No audio files, so nothing to license or load.

// C major pentatonic from C5: every combo step climbs one note, so streaks sound musical.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true
let volume = 0.6

export function configureSound(on: boolean, vol: number): void {
  enabled = on
  volume = vol
  if (master) master.gain.value = volume
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!enabled || volume <= 0) return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.ratio.value = 6
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(comp).connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return { ctx, out: master! }
  } catch {
    return null
  }
}

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  attack?: number
  /** Glide to this frequency over the note. */
  slideTo?: number
  detune?: number
}

function tone(freq: number, start: number, dur: number, o: ToneOpts = {}): void {
  const a = audio()
  if (!a) return
  const t0 = a.ctx.currentTime + start
  const osc = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur)
  if (o.detune) osc.detune.value = o.detune
  const peak = o.gain ?? 0.25
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.008))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(a.out)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

/** Bell-like note: a sine with a quieter octave shimmer on top. */
function bell(freq: number, start: number, dur = 0.35, gain = 0.22): void {
  tone(freq, start, dur, { type: 'sine', gain })
  tone(freq * 2, start, dur * 0.6, { type: 'sine', gain: gain * 0.25 })
  tone(freq, start, dur * 0.5, { type: 'triangle', gain: gain * 0.35, detune: 4 })
}

function noise(start: number, dur: number, from: number, to: number, gain = 0.12): void {
  const a = audio()
  if (!a) return
  const t0 = a.ctx.currentTime + start
  const buffer = a.ctx.createBuffer(1, Math.ceil(a.ctx.sampleRate * dur), a.ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = a.ctx.createBufferSource()
  src.buffer = buffer
  const filter = a.ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(from, t0)
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  const g = a.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(g).connect(a.out)
  src.start(t0)
  src.stop(t0 + dur)
}

const note = (i: number): number => PENTATONIC[Math.max(0, Math.min(PENTATONIC.length - 1, i))]

export const sfx = {
  /** Two rising notes; the pair climbs the scale as the combo grows. */
  correct(combo = 1): void {
    const i = Math.min(combo - 1, PENTATONIC.length - 3)
    bell(note(i), 0, 0.28)
    bell(note(i + 2), 0.075, 0.42)
  },
  close(): void {
    bell(note(1), 0, 0.3, 0.18)
    bell(note(2), 0.08, 0.32, 0.12)
  },
  wrong(): void {
    tone(233, 0, 0.32, { type: 'triangle', gain: 0.16, slideTo: 175 })
    tone(117, 0, 0.32, { type: 'sine', gain: 0.12, slideTo: 92 })
  },
  /** Bright arpeggio at combo milestones (5, 10, 15...). */
  combo(level = 1): void {
    const base = Math.min(level, 3)
    ;[0, 1, 2, 3, 4].forEach((step, k) => bell(note(base + step), k * 0.055, 0.3, 0.16))
  },
  complete(): void {
    ;[0, 2, 3, 5].forEach((i, k) => bell(note(i), k * 0.11, 0.5, 0.2))
    ;[5, 7, 9].forEach((i) => bell(note(i), 0.5, 0.9, 0.14))
  },
  levelUp(): void {
    tone(400, 0, 0.5, { type: 'triangle', gain: 0.12, slideTo: 1200 })
    ;[3, 5, 7, 9].forEach((i, k) => bell(note(i), 0.25 + k * 0.08, 0.45, 0.16))
  },
  flip(): void {
    noise(0, 0.16, 1800, 600, 0.09)
  },
  tap(): void {
    tone(1400, 0, 0.04, { type: 'sine', gain: 0.06 })
  },
  match(): void {
    bell(note(4), 0, 0.2, 0.16)
  },
  heart(): void {
    tone(440, 0, 0.18, { type: 'square', gain: 0.05, slideTo: 330 })
    tone(330, 0.16, 0.3, { type: 'square', gain: 0.05, slideTo: 220 })
  },
  achievement(): void {
    ;[2, 4, 6, 7].forEach((i, k) => bell(note(i), k * 0.09, 0.6, 0.17))
  }
}
