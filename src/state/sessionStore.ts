import { create } from 'zustand'

interface SessionState {
  loggedIn: boolean
  setLoggedIn: (v: boolean) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  loggedIn: false,
  setLoggedIn: (v) => set({ loggedIn: v }),
  reset: () => set({ loggedIn: false }),
}))
