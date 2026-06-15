import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, MenuItem } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'
import { EMPLOYMENT_OPTIONS, EMPLOYED_VALUES } from '../flows/general/constants'

const schema = z.object({ employment: z.string().min(1, 'Required') })
type Values = z.infer<typeof schema>

export const EmploymentStatusStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    // Force an explicit selection rather than defaulting to a value.
    defaultValues: {
      employment: draft.accountHolderEmploymentStatus ?? draft.employmentStatus ?? '',
    },
  })
  const submit = handleSubmit((v) => {
    const employed = EMPLOYED_VALUES.includes(v.employment)
    // Clear stale employer fields when the status no longer requires them.
    patch({
      accountHolderEmploymentStatus: v.employment,
      employmentStatus: v.employment,
      ...(employed ? {} : { occupation: undefined, industry: undefined, employerName: undefined }),
    })
    onNext()
  })
  return (
    <StepLayout title="Employment status" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <Controller
        name="employment"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            select
            label="Employment status"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            {...field}
          >
            <MenuItem value="" disabled>
              Select...
            </MenuItem>
            {EMPLOYMENT_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        )}
      />
    </StepLayout>
  )
}
