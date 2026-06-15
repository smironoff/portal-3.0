import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OtpInput } from './OtpInput'

describe('OtpInput', () => {
  it('emits the joined value once all digits are typed', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    await userEvent.type(screen.getByLabelText('Digit 1'), '1')
    await userEvent.type(screen.getByLabelText('Digit 2'), '2')
    await userEvent.type(screen.getByLabelText('Digit 3'), '3')
    await userEvent.type(screen.getByLabelText('Digit 4'), '4')
    await userEvent.type(screen.getByLabelText('Digit 5'), '5')
    await userEvent.type(screen.getByLabelText('Digit 6'), '6')
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('distributes a pasted code across the fields', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    const first = screen.getByLabelText('Digit 1')
    first.focus()
    await userEvent.paste('987654')
    expect(onComplete).toHaveBeenCalledWith('987654')
  })
})
