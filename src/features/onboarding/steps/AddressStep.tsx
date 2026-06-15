import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  accountHolderPostalCode: z.string().min(1, 'Postcode is required'),
  accountHolderStreetAddress: z.string().optional(),
  accountHolderCity: z.string().optional(),
})
type Values = z.infer<typeof schema>

export const AddressStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountHolderPostalCode: draft.accountHolderPostalCode ?? '',
      accountHolderStreetAddress: draft.accountHolderStreetAddress ?? '',
      accountHolderCity: draft.accountHolderCity ?? '',
    },
  })
  const submit = handleSubmit((v) => {
    patch(v)
    onNext()
  })
  return (
    <StepLayout title="Address" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <TextField
        label="Street address"
        error={!!errors.accountHolderStreetAddress}
        helperText={errors.accountHolderStreetAddress?.message}
        {...register('accountHolderStreetAddress')}
      />
      <TextField
        label="City"
        error={!!errors.accountHolderCity}
        helperText={errors.accountHolderCity?.message}
        {...register('accountHolderCity')}
      />
      <TextField
        label="Postcode"
        error={!!errors.accountHolderPostalCode}
        helperText={errors.accountHolderPostalCode?.message}
        {...register('accountHolderPostalCode')}
      />
    </StepLayout>
  )
}
