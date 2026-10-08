import sampleDeck from '../../../../examples/sample-deck.json?raw'
import { parseImport } from '../core/parse'
import { now } from '../core/clock'
import { importDeck, type ImportSummary } from '../db/repo'

export const SAMPLE_DECK_TEXT = sampleDeck

/** Import the bundled sample deck (used by the first-run screen). */
export async function importSampleDeck(): Promise<ImportSummary> {
  const [deck] = parseImport(sampleDeck).decks
  return importDeck(deck, now())
}
