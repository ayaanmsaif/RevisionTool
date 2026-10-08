import { BrowserWindow, ipcMain } from 'electron'
import { watch, promises as fs, type FSWatcher } from 'fs'
import { extname, join, parse } from 'path'
import { inboxDir } from './files'

const EXTENSIONS = new Set(['.json', '.csv', '.tsv', '.txt', '.md'])
/** Wait for writes to settle: AI tools often write a file in several chunks. */
const SETTLE_MS = 700

let watcher: FSWatcher | null = null
const timers = new Map<string, NodeJS.Timeout>()
const inFlight = new Set<string>()

async function send(getWindow: () => BrowserWindow | null, name: string): Promise<void> {
  timers.delete(name)
  if (inFlight.has(name)) return
  const path = join(inboxDir(), name)
  try {
    const stat = await fs.stat(path)
    if (!stat.isFile()) return
    const content = await fs.readFile(path, 'utf8')
    if (!content.trim()) return
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    inFlight.add(name)
    win.webContents.send('inbox:file', { name, content })
  } catch {
    // The file vanished or is still locked; a later event will retry.
  }
}

function schedule(getWindow: () => BrowserWindow | null, name: string): void {
  if (!EXTENSIONS.has(extname(name).toLowerCase())) return
  clearTimeout(timers.get(name))
  timers.set(
    name,
    setTimeout(() => void send(getWindow, name), SETTLE_MS)
  )
}

/** Move a processed file out of the way so it is not imported twice. */
async function archive(name: string, ok: boolean): Promise<void> {
  const dir = join(inboxDir(), ok ? 'Imported' : 'Failed')
  await fs.mkdir(dir, { recursive: true })
  const { name: base, ext } = parse(name)
  let target = join(dir, name)
  for (
    let i = 2;
    await fs.stat(target).then(
      () => true,
      () => false
    );
    i++
  ) {
    target = join(dir, `${base} (${i})${ext}`)
  }
  await fs.rename(join(inboxDir(), name), target).catch(() => undefined)
}

export function registerInbox(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('inbox:start', async () => {
    await fs.mkdir(inboxDir(), { recursive: true })
    if (!watcher) {
      watcher = watch(inboxDir(), (_event, filename) => {
        if (filename) schedule(getWindow, filename.toString())
      })
    }
    for (const name of await fs.readdir(inboxDir())) schedule(getWindow, name)
    return inboxDir()
  })

  ipcMain.handle('inbox:stop', () => {
    watcher?.close()
    watcher = null
    timers.forEach((t) => clearTimeout(t))
    timers.clear()
  })

  ipcMain.handle('inbox:done', async (_e, args: { name: string; ok: boolean }) => {
    inFlight.delete(args.name)
    await archive(args.name, args.ok)
  })
}
