import { db } from '../db/db'
import * as repo from '../db/repo'
import * as progress from '../db/progress'
import * as clock from '../core/clock'
import { importSampleDeck } from './sample'

/** Expose internals for end-to-end tests. Only active when launched with REVISIONTOOL_DEBUG=1. */
export function installDebugHook(): void {
  if (!window.api?.debug) return
  Object.assign(window, { __rt: { db, repo, progress, clock, importSampleDeck } })
}
