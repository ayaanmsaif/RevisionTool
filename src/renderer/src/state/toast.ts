import { create } from 'zustand'

export type ToastTone = 'info' | 'good' | 'bad' | 'gold'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  body?: string
  action?: { label: string; run: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>, ms?: number) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t, ms = 4500) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { ...t, id }] })
    window.setTimeout(() => get().dismiss(id), ms)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))

export const toast = (t: Omit<Toast, 'id'>, ms?: number): void => useToasts.getState().push(t, ms)
