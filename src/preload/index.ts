import { clipboard, contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// The small, explicit surface the renderer may use. No Node access beyond this.
const api = {
  copyText: (text: string): void => clipboard.writeText(text),
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
