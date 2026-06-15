import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReferStep } from './ReferStep'

describe('ReferStep', () => {
  it('confirm proceeds as REFER', async () => {
    const onNext = vi.fn()
    render(<ReferStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /i understand, proceed/i }))
    expect(onNext).toHaveBeenCalledWith({ appropriatenessLevel: 'REFER' })
  })
  it('cancel proceeds as FAIL', async () => {
    const onNext = vi.fn()
    render(<ReferStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /do not proceed/i }))
    expect(onNext).toHaveBeenCalledWith({ appropriatenessLevel: 'FAIL' })
  })
})
