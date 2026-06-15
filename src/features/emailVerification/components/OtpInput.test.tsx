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

  it('ignores non-digit input', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    const first = screen.getByLabelText('Digit 1')
    await userEvent.type(first, 'a')
    expect((first as HTMLInputElement).value).toBe('')
  })

  it('clears trailing fields when a shorter code is pasted over a full one', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    const first = screen.getByLabelText('Digit 1')
    first.focus()
    await userEvent.paste('123456')
    expect(onComplete).toHaveBeenLastCalledWith('123456')
    first.focus()
    await userEvent.paste('99')
    // only two digits remain; onComplete must NOT be called with a 6-char value built from stale tail
    expect((screen.getByLabelText('Digit 3') as HTMLInputElement).value).toBe('')
  })

  it('clears a filled field on backspace and moves focus back when empty', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    const d1 = screen.getByLabelText('Digit 1') as HTMLInputElement
    const d2 = screen.getByLabelText('Digit 2') as HTMLInputElement
    await userEvent.type(d1, '1')
    await userEvent.type(d2, '2')
    // backspace on filled field clears it in place
    d2.focus()
    await userEvent.keyboard('{Backspace}')
    expect(d2.value).toBe('')
    // backspace again on the now-empty field moves focus to the previous field
    await userEvent.keyboard('{Backspace}')
    expect(d1).toHaveFocus()
  })
})
