import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, MenuItem } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'
import { AU_SOURCE_OF_FUNDS_OPTIONS } from '../flows/general/constants'

const schema = z.object({ sourceOfFunds: z.string().min(1, 'Required') })
type Values = z.infer<typeof schema>

export const SourceOfFundsStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    // Force an explicit selection: auto-selecting a source of funds would
    // silently record an unverified AML attribute for a regulated check.
    defaultValues: { sourceOfFunds: draft.sourceOfFunds ?? '' },
  })
  const submit = handleSubmit((v) => {
    patch({ sourceOfFunds: v.sourceOfFunds })
    onNext()
  })
  return (
    <StepLayout title="Source of funds" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <Controller
        name="sourceOfFunds"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            select
            label="Source of funds"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            {...field}
          >
            <MenuItem value="" disabled>
              Select...
            </MenuItem>
            {AU_SOURCE_OF_FUNDS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        )}
      />
    </StepLayout>
  )
}
