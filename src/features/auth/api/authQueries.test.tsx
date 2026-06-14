import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const api = { login: vi.fn(), verifyTwoFactor: vi.fn(), getUserProfile: vi.fn(), requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn() }
vi.mock('./authApi', () => api)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => Object.values(api).forEach((m) => m.mockReset()))

describe('useLogin', () => {
  it('exposes a mutation that calls authApi.login', async () => {
    api.login.mockResolvedValue({ status: 'OK' })
    const { useLogin } = await import('./authQueries')
    const { result } = renderHook(() => useLogin(), { wrapper })
    result.current.mutate({ email: 'a@b.com', password: 'p', captcha: 'c' })
    await waitFor(() => expect(api.login).toHaveBeenCalledWith('a@b.com', 'p', 'c'))
  })
})
