import type { Verdict } from '../../core/types'

export function verdictClass(v: Verdict | undefined): string {
  if (v === 'correct') return 'border-good bg-good-soft'
  if (v === 'close') return 'border-gold bg-gold-soft'
  if (v === 'wrong') return 'border-bad bg-bad-soft'
  return 'border-line bg-surface focus:border-accent'
}
