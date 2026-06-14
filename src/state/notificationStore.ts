import { create } from 'zustand'

export type Severity = 'error' | 'warning' | 'info' | 'success'
export interface Notification {
  id: string
  severity: Severity
  message: string
}

interface NotificationState {
  items: Notification[]
  push: (n: Omit<Notification, 'id'>) => string
  dismiss: (id: string) => void
}

let counter = 0
export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  push: (n) => {
    const id = `n_${++counter}`
    set((s) => ({ items: [...s.items, { ...n, id }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))
