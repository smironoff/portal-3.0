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
    defaultValues: { sourceOfFunds: draft.sourceOfFunds ?? AU_SOURCE_OF_FUNDS_OPTIONS[0]!.value },
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
        render={({ field }) => (
          <TextField select label="Source of funds" {...field}>
            {AU_SOURCE_OF_FUNDS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        )}
      />
    </StepLayout>
  )
}
