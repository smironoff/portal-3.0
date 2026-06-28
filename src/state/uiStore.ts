import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'
export type Brand = 'default' | 'ib'

export const THEME_STORAGE_KEY = 'themeMode'

// Cold-start theme precedence: a persisted explicit choice wins; otherwise
// follow the OS preference; otherwise light. (matchMedia is guarded so it is
// safe when unavailable, e.g. jsdom.)
const resolveInitialThemeMode = (): ThemeMode => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) return 'dark'
  return 'light'
}

interface UIState {
  language: string
  themeMode: ThemeMode
  brand: Brand
  sidebarOpen: boolean
  setLanguage: (l: string) => void
  setThemeMode: (m: ThemeMode) => void
  setBrand: (b: Brand) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  language: 'en',
  themeMode: resolveInitialThemeMode(),
  brand: 'default',
  sidebarOpen: false,
  setLanguage: (language) => set({ language }),
  setThemeMode: (themeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    set({ themeMode })
  },
  setBrand: (brand) => set({ brand }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
