import { Stack, Typography, Link } from '@mui/material'
import { AU_CONTACT_US_LINK } from './constants'
import type { StepComponentProps } from '../../engine/stepConfig'

// Shown when the appropriateness assessment fails or a terminal status is returned.
// Factory so each jurisdiction can supply its own support contact link.
export const makeAppFailed = (contactLink: string) => (_props: StepComponentProps) => (
  <Stack spacing={2} sx={{ maxWidth: 480 }}>
    <Typography variant="h5">We are unable to open your account</Typography>
    <Typography>
      Based on your responses, trading these products may not be appropriate for you, so we cannot
      proceed with your application at this time.
    </Typography>
    <Typography>
      If you believe this is incorrect, please{' '}
      <Link href={contactLink} target="_blank" rel="noopener noreferrer">
        contact our support team
      </Link>
      .
    </Typography>
  </Stack>
)

// Backward-compatible default export for callers that still import AppFailed directly.
export const AppFailed = makeAppFailed(AU_CONTACT_US_LINK)
