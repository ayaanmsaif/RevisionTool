import { app, BrowserWindow, dialog, ipcMain, shell, type FileFilter } from 'electron'
import { promises as fs } from 'fs'
import { basename, join } from 'path'

/**
 * Where RevisionTool keeps files the student can see: backups and the import inbox.
 * Tests point userData at a throwaway folder, and the data folder follows it.
 */
export function dataDir(): string {
  if (process.env['REVISIONTOOL_USER_DATA']) return join(app.getPath('userData'), 'RevisionTool')
  return join(app.getPath('documents'), 'RevisionTool')
}

export const backupsDir = (): string => join(dataDir(), 'Backups')
export const inboxDir = (): string => join(dataDir(), 'Inbox')

const MAX_BACKUPS = 10

async function pruneBackups(): Promise<void> {
  const files = (await fs.readdir(backupsDir()))
    .filter((f) => f.startsWith('revisiontool-backup-') && f.endsWith('.json'))
    .sort()
  for (const old of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
    await fs.unlink(join(backupsDir(), old)).catch(() => undefined)
  }
}

export function registerFileHandlers(): void {
  ipcMain.handle(
    'file:save',
    async (e, args: { defaultName: string; content: string; filters?: FileFilter[] }) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const options = {
        defaultPath: join(app.getPath('downloads'), args.defaultName),
        filters: args.filters ?? [{ name: 'JSON', extensions: ['json'] }]
      }
      const r = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (r.canceled || !r.filePath) return null
      await fs.writeFile(r.filePath, args.content, 'utf8')
      return r.filePath
    }
  )

  ipcMain.handle('file:open', async (e, args: { filters?: FileFilter[] }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options = {
      properties: ['openFile' as const],
      filters: args.filters ?? [{ name: 'JSON', extensions: ['json'] }]
    }
    const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    const path = r.filePaths[0]
    if (r.canceled || !path) return null
    return { name: basename(path), content: await fs.readFile(path, 'utf8') }
  })

  ipcMain.handle('backup:write', async (_e, args: { name: string; content: string }) => {
    await fs.mkdir(backupsDir(), { recursive: true })
    const path = join(backupsDir(), basename(args.name))
    await fs.writeFile(path, args.content, 'utf8')
    await pruneBackups()
    return path
  })

  ipcMain.handle('folder:open', async (_e, which: 'backups' | 'inbox') => {
    const dir = which === 'inbox' ? inboxDir() : backupsDir()
    await fs.mkdir(dir, { recursive: true })
    return shell.openPath(dir)
  })

  ipcMain.handle('paths:get', () => ({ backups: backupsDir(), inbox: inboxDir() }))
}
