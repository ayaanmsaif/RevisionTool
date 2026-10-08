import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

interface FileFilter {
  name: string
  extensions: string[]
}

// The small, explicit surface the renderer may use. No Node access beyond this.
const api = {
  copyText: (text: string): void => clipboard.writeText(text),
  /** Save dialog; resolves to the chosen path, or null if cancelled. */
  saveFile: (
    defaultName: string,
    content: string,
    filters?: FileFilter[]
  ): Promise<string | null> => ipcRenderer.invoke('file:save', { defaultName, content, filters }),
  /** Open dialog; resolves to the file's name and text, or null if cancelled. */
  openFile: (filters?: FileFilter[]): Promise<{ name: string; content: string } | null> =>
    ipcRenderer.invoke('file:open', { filters }),
  writeBackup: (name: string, content: string): Promise<string> =>
    ipcRenderer.invoke('backup:write', { name, content }),
  openFolder: (which: 'backups' | 'inbox'): Promise<string> =>
    ipcRenderer.invoke('folder:open', which),
  paths: (): Promise<{ backups: string; inbox: string }> => ipcRenderer.invoke('paths:get'),
  /** Start watching the inbox folder; files arrive through onInboxFile. */
  inboxStart: (): Promise<string> => ipcRenderer.invoke('inbox:start'),
  inboxStop: (): Promise<void> => ipcRenderer.invoke('inbox:stop'),
  /** Tell the main process a file was handled so it can be moved out of the inbox. */
  inboxDone: (name: string, ok: boolean): Promise<void> =>
    ipcRenderer.invoke('inbox:done', { name, ok }),
  onInboxFile: (cb: (file: { name: string; content: string }) => void): (() => void) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      file: { name: string; content: string }
    ): void => cb(file)
    ipcRenderer.on('inbox:file', listener)
    return () => ipcRenderer.removeListener('inbox:file', listener)
  },
  installClaudeSkill: (): Promise<string> => ipcRenderer.invoke('skill:install'),
  claudeSkillStatus: (): Promise<{ installed: boolean; path: string }> =>
    ipcRenderer.invoke('skill:status'),
  /** Test hook: exposes the database to automation when REVISIONTOOL_DEBUG=1. */
  debug: process.env['REVISIONTOOL_DEBUG'] === '1'
}

export type RevisionApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
