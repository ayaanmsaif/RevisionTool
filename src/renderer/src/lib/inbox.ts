import { useEffect } from 'react'
import { now } from '../core/clock'
import { parseImport } from '../core/parse'
import { importDeck } from '../db/repo'
import { router } from '../router'
import { toast } from '../state/toast'
import { announceAchievements } from './achievements'
import { sfx } from '../audio/sfx'

/** Import a file that arrived in the inbox folder. Returns whether it worked. */
export async function importInboxFile(name: string, content: string): Promise<boolean> {
  const fallback = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  const result = parseImport(content, fallback)
  const decks = result.decks.filter((d) => d.cards.length)
  if (!decks.length) {
    toast(
      {
        tone: 'bad',
        title: `Could not import ${name}`,
        body:
          result.errors[0] ?? 'No cards were found in the file. It was moved to the Failed folder.'
      },
      8000
    )
    return false
  }
  for (const d of decks) {
    const s = await importDeck(d, now())
    sfx.achievement()
    toast(
      {
        tone: 'good',
        title: `${s.deckName} arrived`,
        body: `${s.added} new card${s.added === 1 ? '' : 's'}${s.updated ? `, ${s.updated} updated` : ''} from the inbox folder.`,
        action: { label: 'Open deck', run: () => void router.navigate(`/deck/${s.deckId}`) }
      },
      8000
    )
  }
  void announceAchievements()
  return true
}

/** Watch the inbox folder while the setting is on. */
export function useInbox(enabled: boolean): void {
  useEffect(() => {
    const api = window.api
    if (!enabled || !api?.inboxStart) return
    const off = api.onInboxFile(({ name, content }) => {
      void importInboxFile(name, content)
        .catch(() => false)
        .then((ok) => api.inboxDone(name, ok))
    })
    void api.inboxStart()
    return () => {
      off()
      void api.inboxStop()
    }
  }, [enabled])
}
