import { ElectronAPI } from '@electron-toolkit/preload'
import type { RevisionApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: RevisionApi
  }
}
