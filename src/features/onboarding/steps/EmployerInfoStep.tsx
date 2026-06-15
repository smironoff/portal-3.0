import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  occupation: z.string().min(1, 'Required'),
  industry: z.string().min(1, 'Required'),
  employerName: z.string().min(1, 'Required'),
})
type Values = z.infer<typeof schema>

export const EmployerInfoStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      occupation: draft.occupation ?? '',
      industry: draft.industry ?? '',
      employerName: draft.employerName ?? '',
    },
  })
  const submit = handleSubmit((v) => {
    patch(v)
    onNext()
  })
  return (
    <StepLayout title="Employer information" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <TextField
        label="Occupation"
        {...register('occupation')}
        error={!!errors.occupation}
        helperText={errors.occupation?.message}
      />
      <TextField
        label="Industry"
        {...register('industry')}
        error={!!errors.industry}
        helperText={errors.industry?.message}
      />
      <TextField
        label="Employer name"
        {...register('employerName')}
        error={!!errors.employerName}
        helperText={errors.employerName?.message}
      />
    </StepLayout>
  )
}
