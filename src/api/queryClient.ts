import { QueryClient } from '@tanstack/react-query'

export const createQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000,
      },
    },
  })
}

// Wire global session teardown: when any layer dispatches TokenExpired,
// clear the query cache and close the session gate.
export const registerTokenExpiredHandler = (
  qc: QueryClient,
  onExpired: () => void
): (() => void) => {
  const handler = (e: Event) => {
    if (!(e instanceof CustomEvent) || e.detail?.source !== 'authClient') return
    qc.clear()
    onExpired()
  }
  window.addEventListener('TokenExpired', handler)
  return () => window.removeEventListener('TokenExpired', handler)
}
