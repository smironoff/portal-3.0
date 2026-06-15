import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
const setLoggedIn = vi.fn()
const storeRegistrationAuth = vi.fn()

vi.mock('../api/countriesQueries', () => ({
  useCountries: () => ({
    data: [{ id: 1, name: 'Australia', code2: 'AU', code3: 'AUS', phoneCode: 61, european: false, organization: { id: 7, name: 'AU' } }],
  }),
}))
vi.mock('../api/registerQueries', () => ({ useRegister: () => ({ mutateAsync, isPending: false }) }))
vi.mock('../api/registerApi', async () => {
  const actual = await vi.importActual<typeof import('../api/registerApi')>('../api/registerApi')
  return { ...actual, storeRegistrationAuth }
})
vi.mock('@/features/auth/hooks/useCaptcha', () => ({
  useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/state/sessionStore', () => ({ useSessionStore: { getState: () => ({ setLoggedIn }) } }))

beforeEach(() => {
  mutateAsync.mockReset()
  navigate.mockReset()
  setLoggedIn.mockReset()
  storeRegistrationAuth.mockReset()
})

const fillStepOne = async () => {
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
  await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Secret12')
  await userEvent.type(screen.getByLabelText(/confirm password/i), 'Secret12')
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
}

describe('RegisterForm', () => {
  it('rejects a weak password', async () => {
    const { RegisterForm } = await import('./RegisterForm')
    render(<RegisterForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'weak')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'weak')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('requires terms acceptance and creates the account on submit', async () => {
    mutateAsync.mockResolvedValue({ session_id: 's', token: 't', payload: [{ status: 'OK', result: { applicationId: 9 } }] })
    const { RegisterForm } = await import('./RegisterForm')
    render(<RegisterForm />)
    await fillStepOne()
    await userEvent.click(screen.getByLabelText(/country of residence/i))
    await userEvent.click(await screen.findByRole('option', { name: 'Australia' }))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/must accept the terms/i)).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
    await userEvent.click(screen.getByLabelText(/i agree/i))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        accountHolderEmail: 'a@b.com', accountHolderPassword: 'Secret12',
        originCountry: 1, preferredOrganization: 7, portalAccountDomain: 'AU',
        agreeToAllTerms: true, isMarketingOptOut: true, accountType: 'individual',
        recaptchaResponse: 'cap',
      })
    )
    expect(storeRegistrationAuth).toHaveBeenCalled()
    expect(setLoggedIn).toHaveBeenCalledWith(true)
    expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' })
  })

  it('shows an inline email error when already registered', async () => {
    const { EmailAlreadyRegisteredError } = await import('../api/registerApi')
    mutateAsync.mockRejectedValue(new EmailAlreadyRegisteredError())
    const { RegisterForm } = await import('./RegisterForm')
    render(<RegisterForm />)
    await fillStepOne()
    await userEvent.click(screen.getByLabelText(/country of residence/i))
    await userEvent.click(await screen.findByRole('option', { name: 'Australia' }))
    await userEvent.click(screen.getByLabelText(/i agree/i))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument()
  })
})
