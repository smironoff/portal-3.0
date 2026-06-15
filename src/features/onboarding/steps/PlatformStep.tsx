import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, MenuItem } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  selectedPlatform: z.enum(['ThinkTrader', 'MT4', 'MT5']),
  platformAccountType: z.enum(['standard']),
  leverage: z.number().int(),
  accountCurrency: z.enum(['USD', 'EUR', 'GBP']),
})
type Values = z.infer<typeof schema>

export const PlatformStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    control,
    handleSubmit,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      selectedPlatform: (draft.selectedPlatform as Values['selectedPlatform']) ?? 'ThinkTrader',
      platformAccountType: (draft.platformAccountType as Values['platformAccountType']) ?? 'standard',
      leverage: draft.leverage ?? 30,
      accountCurrency: (draft.accountCurrency as Values['accountCurrency']) ?? 'USD',
    },
  })
  const submit = handleSubmit((v) => {
    patch(v)
    onNext()
  })
  return (
    <StepLayout title="Platform" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <Controller
        name="selectedPlatform"
        control={control}
        render={({ field }) => (
          <TextField label="Platform" select {...field}>
            <MenuItem value="ThinkTrader">ThinkTrader</MenuItem>
            <MenuItem value="MT4">MT4</MenuItem>
            <MenuItem value="MT5">MT5</MenuItem>
          </TextField>
        )}
      />
      <Controller
        name="platformAccountType"
        control={control}
        render={({ field }) => (
          <TextField label="Account type" select {...field}>
            <MenuItem value="standard">Standard</MenuItem>
          </TextField>
        )}
      />
      <Controller
        name="leverage"
        control={control}
        render={({ field }) => (
          <TextField label="Leverage" select {...field}>
            <MenuItem value={30}>1:30</MenuItem>
            <MenuItem value={100}>1:100</MenuItem>
            <MenuItem value={500}>1:500</MenuItem>
          </TextField>
        )}
      />
      <Controller
        name="accountCurrency"
        control={control}
        render={({ field }) => (
          <TextField label="Account currency" select {...field}>
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="EUR">EUR</MenuItem>
            <MenuItem value="GBP">GBP</MenuItem>
          </TextField>
        )}
      />
    </StepLayout>
  )
}
