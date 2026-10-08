import type { DeckColor } from '../core/types'

/** Deck palette: same lightness band so no deck shouts louder than another. */
export const DECK_COLOR: Record<DeckColor, { base: string; ink: string }> = {
  coral: { base: '#ff6b6b', ink: '#ffffff' },
  tangerine: { base: '#ff922b', ink: '#ffffff' },
  sunflower: { base: '#f5b912', ink: '#2a1f00' },
  lime: { base: '#82c91e', ink: '#132600' },
  emerald: { base: '#1fb37a', ink: '#ffffff' },
  teal: { base: '#14a8b8', ink: '#ffffff' },
  sky: { base: '#339af0', ink: '#ffffff' },
  cobalt: { base: '#4c6ef5', ink: '#ffffff' },
  grape: { base: '#ae5ce0', ink: '#ffffff' },
  rose: { base: '#f06595', ink: '#ffffff' }
}

export function deckStyle(color: DeckColor): React.CSSProperties {
  const c = DECK_COLOR[color] ?? DECK_COLOR.cobalt
  return {
    '--deck': c.base,
    '--deck-ink': c.ink,
    '--deck-soft': `color-mix(in srgb, ${c.base} 16%, var(--surface))`,
    '--deck-press': `color-mix(in srgb, ${c.base} 78%, black)`
  } as React.CSSProperties
}
