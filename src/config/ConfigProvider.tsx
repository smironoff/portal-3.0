import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AppConfig } from './schema'

const ConfigContext = createContext<AppConfig | null>(null)

export function ConfigProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfig(): AppConfig {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}
