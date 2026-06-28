import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRegistrationStore } from '../state/registrationStore'

const navigate = vi.fn()

vi.mock('../api/countriesQueries', () => ({
  useCountries: () => ({
    data: [
      {
        id: 158,
        name: 'Nigeria',
        code2: 'NG',
        code3: 'NGA',
        phoneCode: 234,
        european: false,
        isSimplifyOnboarding: true,
        organization: { id: 14, name: 'TMLC' },
      },
    ],
  }),
}))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate, Link: 'a' }))

beforeEach(() => {
  navigate.mockReset()
  useRegistrationStore.setState({ draft: null })
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

  it('requires terms acceptance then stores the draft and navigates on submit', async () => {
    const { RegisterForm } = await import('./RegisterForm')
    render(<RegisterForm />)
    await fillStepOne()
    await userEvent.click(screen.getByLabelText(/country of residence/i))
    await userEvent.click(await screen.findByRole('option', { name: 'Nigeria' }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/must accept the terms/i)).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    await userEvent.click(screen.getByLabelText(/i agree/i))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(navigate).toHaveBeenCalledWith({ to: '/account/personal-information' })
    const draft = useRegistrationStore.getState().draft
    expect(draft?.originCountry).toBe(158)
    expect(draft?.email).toBe('a@b.com')
    expect(draft?.preferredOrganization).toBe(14)
    expect(draft?.isMarketingOptOut).toBe(true)
    expect(draft?.agreeToAllTerms).toBe(true)
  })
})
