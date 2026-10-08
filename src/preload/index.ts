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
