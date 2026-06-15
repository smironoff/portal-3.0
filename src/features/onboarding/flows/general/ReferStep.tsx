import { Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'
import type { StepComponentProps } from '../../engine/stepConfig'

// Shown when the appropriateness score lands in the REFER band. The user must
// explicitly acknowledge the risk to proceed; cancelling fails the application.
export const ReferStep = ({ onNext }: StepComponentProps) => (
  <Stack spacing={2} sx={{ maxWidth: 520 }}>
    <Typography variant="h5">Trading these products may not be appropriate for you</Typography>
    <Typography>
      Based on your responses, CFDs may not be appropriate for you. CFDs are complex instruments and
      come with a high risk of losing money rapidly due to leverage. You can still choose to proceed,
      but please make sure you understand the risks.
    </Typography>
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" onClick={() => onNext({ appropriatenessLevel: 'FAIL' })}>
        Do not proceed
      </Button>
      <Button onClick={() => onNext({ appropriatenessLevel: 'REFER' })}>I understand, proceed</Button>
    </Stack>
  </Stack>
)
