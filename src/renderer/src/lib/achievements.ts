import { sfx } from '../audio/sfx'
import { now } from '../core/clock'
import { checkAchievements } from '../db/progress'
import { getSettings } from '../db/repo'
import { toast } from '../state/toast'

/** Unlock anything newly earned and celebrate it with a toast. */
export async function announceAchievements(): Promise<void> {
  const unlocked = await checkAchievements(now(), await getSettings())
  if (!unlocked.length) return
  sfx.achievement()
  for (const a of unlocked) {
    toast({ tone: 'gold', title: `Achievement: ${a.title}`, body: a.description }, 6000)
  }
}
