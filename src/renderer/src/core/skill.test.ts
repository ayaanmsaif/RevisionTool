import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { parseImport } from './parse'

const skill = readFileSync(
  resolve(__dirname, '../../../../.claude/skills/make-deck/SKILL.md'),
  'utf8'
)

describe('Claude Code make-deck skill', () => {
  it('has frontmatter Claude Code can load', () => {
    expect(skill).toMatch(/^---\nname: make-deck\ndescription: .+\n---/)
  })

  it('leaves a placeholder for the app to fill in the inbox path', () => {
    expect(skill).toContain('{{INBOX_PATH}}')
  })

  it('only shows example cards the importer accepts', () => {
    const blocks = [...skill.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1])
    const cards = blocks.filter((b) => b.trim().startsWith('{ "id"')).map((b) => JSON.parse(b))
    expect(cards).toHaveLength(3)
    const r = parseImport(JSON.stringify({ deck: { name: 'Skill example' }, cards }))
    expect(r.errors).toEqual([])
    expect(r.decks[0].warnings).toEqual([])
    expect(r.decks[0].cards.map((c) => c.kind)).toEqual(['qa', 'steps', 'essay'])
  })

  it('documents every field the importer reads', () => {
    const fields = [
      'answers',
      'distractors',
      'cloze',
      'false',
      'explain',
      'steps',
      'points',
      'reverse'
    ]
    for (const field of fields) expect(skill).toContain(`"${field}"`)
  })
})
