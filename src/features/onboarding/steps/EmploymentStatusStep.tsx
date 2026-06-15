import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, MenuItem } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'
import { EMPLOYMENT_OPTIONS } from '../flows/general/constants'

const schema = z.object({ employment: z.string().min(1, 'Required') })
type Values = z.infer<typeof schema>

export const EmploymentStatusStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { employment: draft.accountHolderEmploymentStatus ?? EMPLOYMENT_OPTIONS[0]!.value },
  })
  const submit = handleSubmit((v) => {
    patch({ accountHolderEmploymentStatus: v.employment, employmentStatus: v.employment })
    onNext()
  })
  return (
    <StepLayout title="Employment status" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <Controller
        name="employment"
        control={control}
        render={({ field }) => (
          <TextField select label="Employment status" {...field}>
            {EMPLOYMENT_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        )}
      />
    </StepLayout>
  )
}
