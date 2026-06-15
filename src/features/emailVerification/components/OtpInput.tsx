import { useRef } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { Stack, TextField } from '@mui/material'

interface Props {
  length?: number
  onComplete: (value: string) => void
}

export const OtpInput = ({ length = 6, onComplete }: Props) => {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const values = useRef<string[]>(Array(length).fill(''))

  const setAt = (i: number, ch: string) => {
    values.current[i] = ch
    const el = refs.current[i]
    if (el) el.value = ch
  }

  const emit = () => {
    const joined = values.current.join('')
    if (joined.length === length && !values.current.includes('')) onComplete(joined)
  }

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (raw && !digit) {
      const el = refs.current[i]
      if (el) el.value = values.current[i]
      return
    }
    setAt(i, digit)
    if (digit && i < length - 1) refs.current[i + 1]?.focus()
    emit()
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return
    e.preventDefault()
    for (let k = 0; k < length; k++) setAt(k, digits[k] ?? '')
    refs.current[Math.min(digits.length, length - 1)]?.focus()
    emit()
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return
    if (values.current[i]) { setAt(i, ''); return }
    if (i > 0) refs.current[i - 1]?.focus()
  }

  return (
    <Stack direction="row" spacing={1}>
      {Array.from({ length }).map((_, i) => (
        <TextField
          key={i}
          inputRef={(el: HTMLInputElement | null) => { refs.current[i] = el }}
          onChange={(e) => handleChange(i, e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => handleKeyDown(i, e)}
          slotProps={{ htmlInput: { maxLength: 1, inputMode: 'numeric', 'aria-label': `Digit ${i + 1}` } }}
          sx={{ width: 48 }}
        />
      ))}
    </Stack>
  )
}
