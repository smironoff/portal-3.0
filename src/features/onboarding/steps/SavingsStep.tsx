import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, MenuItem } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'
import { AU_MONEY_OPTIONS } from '../flows/general/constants'

const schema = z.object({ estimatedNetWorth: z.string().min(1, 'Required') })
type Values = z.infer<typeof schema>

export const SavingsStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { estimatedNetWorth: draft.estimatedNetWorth ?? AU_MONEY_OPTIONS[0]!.value },
  })
  const submit = handleSubmit((v) => {
    patch({ estimatedNetWorth: v.estimatedNetWorth })
    onNext()
  })
  return (
    <StepLayout title="Estimated net worth" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <Controller
        name="estimatedNetWorth"
        control={control}
        render={({ field }) => (
          <TextField select label="Estimated net worth" {...field}>
            {AU_MONEY_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        )}
      />
    </StepLayout>
  )
}
