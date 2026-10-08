import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { CheckCircleIcon, WarningCircleIcon, XCircleIcon, XIcon } from '@phosphor-icons/react'
import { sfx } from '../audio/sfx'
import { now } from '../core/clock'
import { capableFormats } from '../core/formats'
import { isTypeable } from '../core/grading'
import { buildQuestion, fillCloze, FORMAT_LABEL, type Question } from '../core/questions'
import { MemState, type CardRecord, type Format } from '../core/types'
import { shuffle } from '../core/util'
import { db } from '../db/db'
import { getSettings, recordGameAnswer } from '../db/repo'
import { awardXp } from '../db/progress'
import { celebrate } from '../lib/confetti'
import { useSettings } from '../state/hooks'
import { RichText } from '../components/RichText'
import { Button } from '../components/ui/Button'
import { Segmented } from '../components/ui/Controls'
import type { ResultIn } from '../study/controller'
import { McqView } from '../study/views/McqView'
import { TrueFalseView } from '../study/views/TrueFalseView'
import { TypedView } from '../study/views/TypedView'
import { ClozeView } from '../study/views/ClozeView'
import { OrderView } from '../study/views/OrderView'

interface Item {
  card: CardRecord
  format: Format
  question: Question
}

interface Answered extends Item {
  result: ResultIn
}

/** Exam-style formats: mostly recall, with some recognition for long answers. */
function testFormat(card: CardRecord, peers: number): Format {
  if (card.kind === 'steps') return 'order'
  const can = capableFormats(card, peers)
  const options: Format[] = []
  if (can.has('typed') && isTypeable(card.a)) options.push('typed', 'typed')
  if (can.has('cloze')) options.push('cloze')
  if (can.has('mcq')) options.push('mcq')
  if (can.has('truefalse')) options.push('truefalse')
  return options.length ? options[Math.floor(Math.random() * options.length)] : 'mcq'
}

export function TestMode(): React.JSX.Element {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const reduce = useReducedMotion()
  const deckIds = params.get('decks')?.split(',').filter(Boolean)
  const key = deckIds?.join(',') ?? 'all'
  const pool = useLiveQuery(async () => {
    const cards = deckIds?.length
      ? await db.cards.where('deckId').anyOf(deckIds).toArray()
      : await db.cards.toArray()
    return cards.filter((c) => !c.suspended && c.kind !== 'essay')
  }, [key])
  const [size, setSize] = useState(20)
  const [items, setItems] = useState<Item[] | null>(null)
  const [answers, setAnswers] = useState<Answered[]>([])
  const [locked, setLocked] = useState(false)
  const close = (): void => {
    void navigate('/games')
  }

  const start = (): void => {
    if (!pool) return
    // Favour cards already started: a test checks what you have learned.
    const seen = shuffle(pool.filter((c) => c.mem.state !== MemState.New))
    const fresh = shuffle(pool.filter((c) => c.mem.state === MemState.New))
    const chosen = [...seen, ...fresh].slice(0, size)
    setItems(
      shuffle(chosen).map((card) => {
        const peers = pool.filter((p) => p.deckId === card.deckId && p.kind === 'qa')
        const format = testFormat(card, peers.length - 1)
        return { card, format, question: buildQuestion(card, format, peers, Math.random) }
      })
    )
    setAnswers([])
  }

  const onAnswer = (item: Item, results: ResultIn[]): void => {
    if (locked) return
    setLocked(true)
    sfx.tap()
    window.setTimeout(async () => {
      const next = [...answers, { ...item, result: results[0] }]
      setAnswers(next)
      setLocked(false)
      void recordGameAnswer(item.card, item.format, results[0].verdict, 0, now())
      if (items && next.length === items.length) {
        const right = next.filter((a) => a.result.verdict !== 'wrong').length
        sfx.complete()
        if (right / next.length >= 0.9) celebrate(true)
        if (right) await awardXp(right * 2, now(), await getSettings())
      }
    }, 260)
  }

  if (!pool) return <div className="grid h-full place-items-center text-ink-muted">Loading</div>

  const current = items && answers.length < items.length ? items[answers.length] : null
  const finished = items && answers.length === items.length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-5 px-8 pt-6 pb-2">
        <button
          type="button"
          aria-label="Leave test"
          onClick={close}
          className="grid size-10 place-items-center rounded-control text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <XIcon size={24} />
        </button>
        <p className="font-display text-xl font-bold">Test</p>
        {items && !finished && (
          <>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${(answers.length / items.length) * 100}%` }}
              />
            </div>
            <span className="font-extrabold tabular">
              {answers.length + 1} / {items.length}
            </span>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-12">
        {!items && (
          <div className="mx-auto mt-12 max-w-[560px]">
            <h1 className="font-display text-3xl font-bold tracking-tight">Test yourself</h1>
            <p className="mt-2 text-ink-muted">
              Exam conditions: mixed questions, no answers shown until the end. Tests do not change
              your review schedule, so take one whenever you like.
            </p>
            <div className="mt-8">
              <p className="mb-2 text-sm font-extrabold">Questions</p>
              <Segmented
                value={size}
                options={[10, 20, 30, 50].map((n) => ({ value: n, label: String(n) }))}
                onChange={setSize}
              />
            </div>
            <Button size="xl" className="mt-8" onClick={start} disabled={pool.length === 0}>
              Start the test
            </Button>
            {pool.length === 0 && <p className="mt-3 text-ink-muted">Import a deck first.</p>}
          </div>
        )}

        {current && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={answers.length}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-[820px] pt-8"
            >
              <span className="mb-5 inline-block rounded-full bg-accent-soft px-3 py-1 text-sm font-extrabold text-accent">
                {FORMAT_LABEL[current.format]}
              </span>
              <TestQuestion
                item={current}
                onAnswer={(r) => onAnswer(current, r)}
                grading={settings}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {finished && <Results answers={answers} onAgain={start} onClose={close} />}
      </div>
    </div>
  )
}

function TestQuestion({
  item,
  onAnswer,
  grading
}: {
  item: Item
  onAnswer: (r: ResultIn[]) => void
  grading: { accentStrict: boolean; typoTolerance: 'off' | 'normal' | 'lenient' }
}): React.JSX.Element {
  const props = {
    card: item.card,
    cards: [item.card],
    feedback: undefined,
    onAnswer,
    grading: { accentStrict: grading.accentStrict, typoTolerance: grading.typoTolerance }
  }
  const q = item.question
  if (q.type === 'mcq') return <McqView {...props} question={q} pretest={false} reveal={false} />
  if (q.type === 'truefalse') return <TrueFalseView {...props} question={q} reveal={false} />
  if (q.type === 'typed') return <TypedView {...props} question={q} />
  if (q.type === 'cloze') return <ClozeView {...props} question={q} />
  if (q.type === 'order') return <OrderView {...props} question={q} />
  // Test mode only builds the formats above.
  return <></>
}

function correctText(a: Answered): string {
  const q = a.question
  if (q.type === 'truefalse') return q.isTrue ? 'True' : `False. ${q.correction}`
  if (q.type === 'cloze') return fillCloze(a.card.cloze ?? a.card.a)
  if (q.type === 'order') return a.card.steps.join(' → ')
  return a.card.a
}

function Results({
  answers,
  onAgain,
  onClose
}: {
  answers: Answered[]
  onAgain: () => void
  onClose: () => void
}): React.JSX.Element {
  const right = answers.filter((a) => a.result.verdict !== 'wrong').length
  const pct = Math.round((right / answers.length) * 100)
  return (
    <div className="mx-auto max-w-[820px] pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-extrabold text-ink-muted">Your score</p>
          <p className="font-display text-6xl font-bold">{pct}%</p>
          <p className="mt-1 text-ink-muted">
            {right} of {answers.length} right.{' '}
            {pct >= 80
              ? 'Exam ready on these cards.'
              : 'Review the misses below, then keep up your daily lessons.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Done
          </Button>
          <Button size="lg" onClick={onAgain}>
            New test
          </Button>
        </div>
      </div>
      <ul className="mt-8 flex flex-col gap-3">
        {answers.map((a, i) => {
          const v = a.result.verdict
          const Icon =
            v === 'correct' ? CheckCircleIcon : v === 'close' ? WarningCircleIcon : XCircleIcon
          return (
            <li
              key={i}
              className={clsx(
                'flex gap-4 rounded-card border-2 p-5',
                v === 'correct' ? 'border-line' : v === 'close' ? 'border-gold' : 'border-bad'
              )}
            >
              <Icon
                size={28}
                weight="fill"
                className={clsx(
                  'shrink-0',
                  v === 'correct' ? 'text-good' : v === 'close' ? 'text-gold-press' : 'text-bad'
                )}
              />
              <div className="min-w-0 flex-1">
                <RichText text={a.card.q} className="font-bold" />
                {v !== 'correct' && a.result.given && (
                  <p className="mt-1 text-sm text-ink-muted">
                    You answered <span className="font-bold text-ink">{a.result.given}</span>
                  </p>
                )}
                <div className="mt-1 text-sm">
                  <span className="font-extrabold text-ink-muted">Answer </span>
                  <RichText inline text={correctText(a)} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
