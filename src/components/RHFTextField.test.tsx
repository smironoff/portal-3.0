import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { RHFTextField } from './RHFTextField'

function Harness() {
  const methods = useForm({ defaultValues: { email: '' } })
  return (
    <FormProvider {...methods}>
      <RHFTextField name="email" label="Email" />
    </FormProvider>
  )
}

describe('RHFTextField', () => {
  it('renders the label and accepts input', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Email')
    await userEvent.type(input, 'a@b.com')
    expect(input).toHaveValue('a@b.com')
  })
})
