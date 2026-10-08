import { useState } from 'react'
import clsx from 'clsx'
import {
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  FolderOpenIcon,
  SpeakerHighIcon,
  UploadSimpleIcon,
  WarningIcon
} from '@phosphor-icons/react'
import { sfx } from '../audio/sfx'
import { now } from '../core/clock'
import { FORMAT_LABEL } from '../core/questions'
import type { Settings, ThemeSetting } from '../core/settings'
import type { Format } from '../core/types'
import { backupName, exportAll, restoreAll } from '../db/backup'
import { db } from '../db/db'
import { saveSettings } from '../db/repo'
import { useSettings } from '../state/hooks'
import { toast } from '../state/toast'
import { Button } from '../components/ui/Button'
import { Field, Segmented, Switch, inputClass } from '../components/ui/Controls'
import { Modal } from '../components/ui/Modal'
import { PageHeader, Panel, SectionTitle } from '../components/ui/Panel'

const FORMAT_HELP: Partial<Record<Format, string>> = {
  mcq: 'Pick the right answer. Used while a card is new.',
  truefalse: 'Judge a statement. Quick recognition practice.',
  match: 'Pair several questions with their answers at once.',
  cloze: 'Type the missing word in a sentence.',
  typed: 'Type the answer from memory. The strongest practice.',
  order: 'Put the steps of a process in order.',
  blurt: 'Write everything you remember, then tick off key points.'
}

export function SettingsScreen(): React.JSX.Element {
  const s = useSettings()
  const set = (patch: Partial<Settings>): void => void saveSettings(patch)
  const [restoreText, setRestoreText] = useState<{ name: string; content: string } | null>(null)
  const [wipe, setWipe] = useState(false)
  const devTools = import.meta.env.DEV || window.api?.debug

  const backupNow = async (): Promise<void> => {
    const file = await exportAll(now())
    const path = await window.api.saveFile(backupName(now()), JSON.stringify(file))
    if (path) toast({ tone: 'good', title: 'Backup saved', body: path })
  }

  return (
    <div className="mx-auto max-w-[880px] px-10 py-10">
      <PageHeader
        title="Settings"
        subtitle="Everything is stored on this computer. Nothing is sent anywhere."
      />

      <div className="flex flex-col gap-6">
        <Section title="Studying">
          <Field label="Daily XP goal" hint="Reaching it each day keeps your streak going.">
            <Segmented
              value={s.dailyGoal}
              size="sm"
              options={[30, 50, 100, 150].map((v) => ({ value: v, label: `${v} XP` }))}
              onChange={(dailyGoal) => set({ dailyGoal })}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              label="New cards per day"
              hint="Across all decks. About 10 to 30 suits most people."
              value={s.newPerDay}
              min={0}
              max={500}
              onChange={(newPerDay) => set({ newPerDay })}
            />
            <NumberField
              label="Maximum reviews per day"
              hint="Reviews past this wait until tomorrow."
              value={s.maxReviewsPerDay}
              min={10}
              max={5000}
              onChange={(maxReviewsPerDay) => set({ maxReviewsPerDay })}
            />
          </div>
          <Field label="Cards per lesson">
            <Segmented
              value={s.lessonSize}
              size="sm"
              options={[8, 12, 16, 20, 30].map((v) => ({ value: v, label: String(v) }))}
              onChange={(lessonSize) => set({ lessonSize })}
            />
          </Field>
          <Field
            label={`Desired retention: ${Math.round(s.retention * 100)}%`}
            htmlFor="retention"
            hint="How sure you want to be of remembering a card when it comes back. Higher means more reviews; 90% is the sweet spot for most students, 95% before a big exam."
          >
            <input
              id="retention"
              type="range"
              min={0.8}
              max={0.97}
              step={0.01}
              value={s.retention}
              onChange={(e) => set({ retention: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
          <Switch
            checked={s.hardcore}
            onChange={(hardcore) => set({ hardcore })}
            label="Hardcore mode"
            description="5 hearts per lesson; each mistake costs one and the lesson ends at zero. Mistakes help you learn, so this is off by default."
          />
        </Section>

        <Section title="Question types">
          <Switch
            checked={s.formats.classic}
            onChange={(classic) => set({ formats: { ...s.formats, classic } })}
            label="Classic flashcards"
            description="Every card is a plain flip card you rate yourself, like Anki."
          />
          <div
            className={clsx(
              'flex flex-col gap-4',
              s.formats.classic && 'pointer-events-none opacity-50'
            )}
          >
            {(Object.keys(FORMAT_HELP) as Format[]).map((f) => (
              <Switch
                key={f}
                checked={s.formats.enabled[f]}
                onChange={(on) =>
                  set({ formats: { ...s.formats, enabled: { ...s.formats.enabled, [f]: on } } })
                }
                label={FORMAT_LABEL[f]}
                description={FORMAT_HELP[f]}
              />
            ))}
            <p className="text-sm text-ink-muted">
              Recall (flip cards) is always available as a fallback.
            </p>
          </div>
        </Section>

        <Section title="Answer checking">
          <Field
            label="Typo tolerance"
            hint="How forgiving typed answers are with spelling slips. Close answers count, but are scheduled a little sooner."
          >
            <Segmented
              value={s.typoTolerance}
              size="sm"
              options={[
                { value: 'off', label: 'Exact' },
                { value: 'normal', label: 'Normal' },
                { value: 'lenient', label: 'Lenient' }
              ]}
              onChange={(typoTolerance) => set({ typoTolerance })}
            />
          </Field>
          <Switch
            checked={s.accentStrict}
            onChange={(accentStrict) => set({ accentStrict })}
            label="Strict accents"
            description="For language learners: a missing accent counts as almost right instead of correct."
          />
        </Section>

        <Section title="Sound and look">
          <Switch checked={s.sound} onChange={(sound) => set({ sound })} label="Sound effects" />
          <Field label={`Volume: ${Math.round(s.volume * 100)}%`} htmlFor="volume">
            <div className="flex items-center gap-4">
              <input
                id="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.volume}
                disabled={!s.sound}
                onChange={(e) => set({ volume: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!s.sound}
                onClick={() => sfx.correct(4)}
              >
                <SpeakerHighIcon /> Test
              </Button>
            </div>
          </Field>
          <Field label="Theme">
            <Segmented
              value={s.theme}
              size="sm"
              options={[
                { value: 'system' as ThemeSetting, label: 'Match system' },
                { value: 'light' as ThemeSetting, label: 'Light' },
                { value: 'dark' as ThemeSetting, label: 'Dark' }
              ]}
              onChange={(theme) => set({ theme })}
            />
          </Field>
        </Section>

        <Section title="Your data">
          <p className="text-ink-muted">
            RevisionTool saves a backup automatically once a day and keeps the last 10.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={backupNow}>
              <DownloadSimpleIcon /> Save a backup
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const file = await window.api.openFile()
                if (file) setRestoreText(file)
              }}
            >
              <UploadSimpleIcon /> Restore from backup
            </Button>
            <Button variant="ghost" onClick={() => void window.api.openFolder('backups')}>
              <FolderOpenIcon /> Open backups folder
            </Button>
          </div>
          <div className="mt-2 border-t border-line pt-5">
            <Button variant="ghost" className="text-bad" onClick={() => setWipe(true)}>
              <WarningIcon /> Delete all decks and progress
            </Button>
          </div>
        </Section>

        {devTools && (
          <Section title="Developer">
            <Field
              label={`Time travel: ${s.clockOffsetDays} day${s.clockOffsetDays === 1 ? '' : 's'} ahead`}
              hint="Pretend it is a later day to test schedules and streaks."
            >
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => set({ clockOffsetDays: s.clockOffsetDays + 1 })}
                >
                  +1 day
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => set({ clockOffsetDays: s.clockOffsetDays + 7 })}
                >
                  +1 week
                </Button>
                <Button variant="ghost" size="sm" onClick={() => set({ clockOffsetDays: 0 })}>
                  <ClockCounterClockwiseIcon /> Back to today
                </Button>
              </div>
            </Field>
          </Section>
        )}
      </div>

      {restoreText && (
        <Modal
          title="Restore this backup?"
          onClose={() => setRestoreText(null)}
          footer={
            <>
              <span />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setRestoreText(null)}>
                  Cancel
                </Button>
                <Button
                  variant="bad"
                  onClick={async () => {
                    try {
                      const r = await restoreAll(JSON.parse(restoreText.content))
                      toast({
                        tone: 'good',
                        title: 'Backup restored',
                        body: `${r.decks} decks, ${r.cards} cards.`
                      })
                    } catch (e) {
                      toast({
                        tone: 'bad',
                        title: 'Could not restore',
                        body: e instanceof Error ? e.message : String(e)
                      })
                    }
                    setRestoreText(null)
                  }}
                >
                  Replace everything
                </Button>
              </div>
            </>
          }
        >
          <p>
            Everything currently in RevisionTool will be replaced by{' '}
            <strong>{restoreText.name}</strong>. Save a backup first if you might want today&apos;s
            data back.
          </p>
        </Modal>
      )}

      {wipe && (
        <Modal
          title="Delete everything?"
          onClose={() => setWipe(false)}
          footer={
            <>
              <span />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setWipe(false)}>
                  Cancel
                </Button>
                <Button
                  variant="bad"
                  onClick={async () => {
                    await db.transaction('rw', db.decks, db.cards, db.reviews, async () => {
                      await Promise.all([db.decks.clear(), db.cards.clear(), db.reviews.clear()])
                    })
                    toast({ tone: 'info', title: 'All decks and progress deleted' })
                    setWipe(false)
                  }}
                >
                  Delete everything
                </Button>
              </div>
            </>
          }
        >
          <p>
            All decks, cards and review history will be deleted. Your settings, XP and achievements
            stay. Automatic backups in the backups folder are not touched.
          </p>
        </Modal>
      )}
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Panel className="flex flex-col gap-5 p-7">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </Panel>
  )
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}): React.JSX.Element {
  const id = `num-${label.replace(/\W+/g, '-').toLowerCase()}`
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        inputMode="numeric"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => {
          if (draft !== null && draft !== '') onChange(Math.min(max, Math.max(min, Number(draft))))
          setDraft(null)
        }}
        className={clsx(inputClass, 'w-36!')}
      />
    </Field>
  )
}
