import { useState } from 'react'
import { useNavigate } from 'react-router'
import clsx from 'clsx'
import { CheckIcon, ExportIcon, TrashIcon } from '@phosphor-icons/react'
import { deckToJson, fileSafe } from '../core/exporter'
import { DECK_COLORS, type Deck, type DeckColor } from '../core/types'
import { db } from '../db/db'
import { deleteDeck, findDeckByName, updateDeck } from '../db/repo'
import { DECK_COLOR } from '../lib/deckColors'
import { toast } from '../state/toast'
import { Button } from './ui/Button'
import { Field, inputClass } from './ui/Controls'
import { Modal } from './ui/Modal'

export function DeckSettings({
  deck,
  onClose
}: {
  deck: Deck
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const [name, setName] = useState(deck.name)
  const [emoji, setEmoji] = useState(deck.emoji)
  const [color, setColor] = useState<DeckColor>(deck.color)
  const [subject, setSubject] = useState(deck.subject ?? '')
  const [level, setLevel] = useState(deck.level ?? '')
  const [newPerDay, setNewPerDay] = useState(deck.newPerDay?.toString() ?? '')
  const [error, setError] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return setError('The deck needs a name.')
    const clash = await findDeckByName(trimmed)
    if (clash && clash.id !== deck.id) return setError('Another deck already has this name.')
    const limit = newPerDay.trim() === '' ? undefined : Math.max(0, Math.round(Number(newPerDay)))
    if (limit !== undefined && Number.isNaN(limit))
      return setError('New cards per day must be a number.')
    await updateDeck(deck.id, {
      name: trimmed,
      emoji: emoji.trim() || '📚',
      color,
      subject: subject.trim() || undefined,
      level: level.trim() || undefined,
      newPerDay: limit
    })
    toast({ tone: 'good', title: 'Deck saved' })
    onClose()
  }

  const exportDeck = async (): Promise<void> => {
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    const json = JSON.stringify(deckToJson(deck, cards), null, 2)
    const path = await window.api.saveFile(`${fileSafe(deck.name)}.json`, json)
    if (path)
      toast({
        tone: 'good',
        title: 'Deck exported',
        body: 'Anyone with RevisionTool can import this file.'
      })
  }

  return (
    <Modal
      title="Deck settings"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            className={clsx(confirmDelete && 'text-bad')}
            onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true)
              await deleteDeck(deck.id)
              toast({ tone: 'info', title: `${deck.name} deleted` })
              navigate('/')
            }}
          >
            <TrashIcon /> {confirmDelete ? 'Click again to delete for good' : 'Delete deck'}
          </Button>
          <div className="flex items-center gap-3">
            {error && <p className="text-sm font-bold text-bad">{error}</p>}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
          <Field label="Emoji" htmlFor="deck-emoji">
            <input
              id="deck-emoji"
              value={emoji}
              maxLength={8}
              onChange={(e) => setEmoji(e.target.value)}
              className={clsx(inputClass, 'text-center text-xl')}
            />
          </Field>
          <Field label="Name" htmlFor="deck-name">
            <input
              id="deck-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Deck colour">
            {DECK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={c}
                onClick={() => setColor(c)}
                className={clsx(
                  'grid size-10 place-items-center rounded-full transition-transform hover:scale-110',
                  c === color && 'ring-3 ring-ink ring-offset-2 ring-offset-surface'
                )}
                style={{ background: DECK_COLOR[c].base, color: DECK_COLOR[c].ink }}
              >
                {c === color && <CheckIcon weight="bold" />}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Subject" htmlFor="deck-subject">
            <input
              id="deck-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Level" htmlFor="deck-level">
            <input
              id="deck-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field
          label="New cards per day"
          htmlFor="deck-new"
          hint="Leave empty to use your overall setting. Lower it for big decks so reviews stay manageable."
        >
          <input
            id="deck-new"
            inputMode="numeric"
            value={newPerDay}
            onChange={(e) => setNewPerDay(e.target.value.replace(/[^\d]/g, ''))}
            className={clsx(inputClass, 'w-32!')}
          />
        </Field>
        <div className="rounded-card bg-sunken p-5">
          <p className="font-extrabold">Share or back up this deck</p>
          <p className="mt-1 text-sm text-ink-muted">
            Exports the cards in the RevisionTool format. Progress is not included, so a friend
            starts fresh.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={exportDeck}>
            <ExportIcon /> Export deck
          </Button>
        </div>
      </div>
    </Modal>
  )
}
