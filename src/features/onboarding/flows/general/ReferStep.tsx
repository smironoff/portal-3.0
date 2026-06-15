import { Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'
import type { StepComponentProps } from '../../engine/stepConfig'

// Shown when the appropriateness score lands in the REFER band. The user must
// explicitly acknowledge the risk to proceed; cancelling fails the application.
// TODO(compliance): supply the TMCY/TMEU retail-loss percentage and final ESMA/CySEC wording before production.
export const ReferStep = ({ onNext }: StepComponentProps) => (
  <Stack spacing={2} sx={{ maxWidth: 520 }}>
    <Typography variant="h5">Trading these products may not be appropriate for you</Typography>
    <Typography>
      Based on your responses, CFDs may not be appropriate for you.
    </Typography>
    <Typography>
      CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.
      {' '}[COMPLIANCE: insert the firm-specific figure] of retail investor accounts lose money when
      trading CFDs with this provider. You should consider whether you understand how CFDs work and
      whether you can afford to take the high risk of losing your money.
    </Typography>
    <Typography>
      You can still choose to proceed, but please make sure you understand the risks.
    </Typography>
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" onClick={() => onNext({ appropriatenessLevel: 'FAIL' })}>
        Do not proceed
      </Button>
      <Button onClick={() => onNext({ appropriatenessLevel: 'REFER', isReferAcknowledged: true })}>
        I understand, proceed
      </Button>
    </Stack>
  </Stack>
)
