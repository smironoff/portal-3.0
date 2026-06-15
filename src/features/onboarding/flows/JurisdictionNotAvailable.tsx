import { Stack, Typography } from '@mui/material'

export const JurisdictionNotAvailable = ({ domain }: { domain?: string }) => (
  <Stack spacing={2} sx={{ maxWidth: 480 }}>
    <Typography variant="h5">Onboarding not yet available</Typography>
    <Typography>
      Online onboarding for your region{domain ? ` (${domain})` : ''} is not available yet. Please
      contact support to continue.
    </Typography>
  </Stack>
)
