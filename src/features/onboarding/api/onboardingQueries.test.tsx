import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const api = { loadApplication: vi.fn(), getQuestions: vi.fn(), incrementalSubmit: vi.fn(), submitLevelOne: vi.fn(), submitLevelTwo: vi.fn(), loadApplicationStatuses: vi.fn() }
vi.mock('./onboardingApi', () => api)

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => Object.values(api).forEach((m) => m.mockReset()))

describe('useApplication', () => {
  it('loads the application when enabled', async () => {
    api.loadApplication.mockResolvedValue({ status: 'INCOMPLETE' })
    const { useApplication } = await import('./onboardingQueries')
    const { result } = renderHook(() => useApplication(true), { wrapper })
    await waitFor(() => expect(result.current.data?.status).toBe('INCOMPLETE'))
  })
})

describe('useApplicationStatuses', () => {
  it('loads the statuses array', async () => {
    api.loadApplicationStatuses.mockResolvedValue([{ application_status: 'APPROVED' }])
    const { useApplicationStatuses } = await import('./onboardingQueries')
    const { result } = renderHook(() => useApplicationStatuses(true), { wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.application_status).toBe('APPROVED'))
  })
})
