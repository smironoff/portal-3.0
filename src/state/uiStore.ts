import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'
export type Brand = 'default' | 'ib'

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
  themeMode: 'light',
  brand: 'default',
  sidebarOpen: true,
  setLanguage: (language) => set({ language }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setBrand: (brand) => set({ brand }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
