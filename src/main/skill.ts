import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import skillTemplate from '../../.claude/skills/make-deck/SKILL.md?raw'
import { inboxDir } from './files'

export const skillPath = (): string => join(homedir(), '.claude', 'skills', 'make-deck', 'SKILL.md')

/** The skill text with this computer's real inbox folder filled in. */
export function skillText(): string {
  return skillTemplate.replace('{{INBOX_PATH}}', inboxDir().split('\\').join('/'))
}

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:install', async () => {
    await fs.mkdir(join(homedir(), '.claude', 'skills', 'make-deck'), { recursive: true })
    await fs.mkdir(inboxDir(), { recursive: true })
    await fs.writeFile(skillPath(), skillText(), 'utf8')
    return skillPath()
  })
  ipcMain.handle('skill:status', async () => {
    const installed = await fs.stat(skillPath()).then(
      () => true,
      () => false
    )
    return { installed, path: skillPath() }
  })
}
