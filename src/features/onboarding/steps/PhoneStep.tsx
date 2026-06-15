import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  accountHolderPhoneCode: z.number().int(),
  accountHolderPhone: z.string().min(3, 'Phone number is required'),
})
type Values = z.infer<typeof schema>

export const PhoneStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountHolderPhoneCode: draft.accountHolderPhoneCode ?? 0,
      accountHolderPhone: draft.accountHolderPhone ?? '',
    },
  })
  const submit = handleSubmit((v) => {
    patch(v)
    onNext()
  })
  return (
    <StepLayout title="Phone number" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <TextField
        label="Country code"
        type="number"
        error={!!errors.accountHolderPhoneCode}
        helperText={errors.accountHolderPhoneCode?.message}
        {...register('accountHolderPhoneCode', { valueAsNumber: true })}
      />
      <TextField
        label="Phone number"
        error={!!errors.accountHolderPhone}
        helperText={errors.accountHolderPhone?.message}
        {...register('accountHolderPhone')}
      />
    </StepLayout>
  )
}
