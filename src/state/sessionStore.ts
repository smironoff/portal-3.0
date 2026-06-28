import { create } from 'zustand'
import { tokenStore } from '@/api/tokenStore'

interface SessionState {
  loggedIn: boolean
  setLoggedIn: (v: boolean) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  // Rehydrate from a valid persisted token so a logged-in session survives a
  // full page load (refresh / direct navigation), not just in-session routing.
  loggedIn: tokenStore.hasValidSession(),
  setLoggedIn: (v) => set({ loggedIn: v }),
  reset: () => set({ loggedIn: false }),
}))
