import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'

export const StepLayout = ({
  title,
  children,
  onSubmit,
  canGoBack,
  onBack,
  submitLabel = 'Continue',
}: {
  title: string
  children: ReactNode
  onSubmit: () => void
  canGoBack: boolean
  onBack?: () => void
  submitLabel?: string
}) => (
  <Box
    component="form"
    onSubmit={(e) => {
      e.preventDefault()
      onSubmit()
    }}
    noValidate
    sx={{ maxWidth: 420 }}
  >
    <Stack spacing={2}>
      <Typography variant="h5">{title}</Typography>
      {children}
      <Stack direction="row" spacing={1}>
        {canGoBack && onBack && (
          <Button variant="outlined" onClick={onBack} type="button">
            Back
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </Stack>
    </Stack>
  </Box>
)
