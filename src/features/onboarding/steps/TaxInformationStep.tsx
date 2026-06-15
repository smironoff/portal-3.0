import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  taxIdentificationNumber: z.string().min(1, 'Tax ID is required'),
  accountHolderNationality: z.number().int().positive('Nationality is required'),
})
type Values = z.infer<typeof schema>

export const TaxInformationStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      taxIdentificationNumber: draft.taxIdentificationNumber ?? '',
      accountHolderNationality: draft.accountHolderNationality,
    },
  })
  const submit = handleSubmit((v) => {
    patch({
      taxIdentificationNumber: v.taxIdentificationNumber,
      accountHolderIdNumber: v.taxIdentificationNumber,
      accountHolderNationality: v.accountHolderNationality,
    })
    onNext()
  })
  return (
    <StepLayout title="Tax information" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <TextField
        label="Tax identification number"
        error={!!errors.taxIdentificationNumber}
        helperText={errors.taxIdentificationNumber?.message}
        {...register('taxIdentificationNumber')}
      />
      <TextField
        label="Nationality (country code)"
        type="number"
        error={!!errors.accountHolderNationality}
        helperText={errors.accountHolderNationality?.message}
        {...register('accountHolderNationality', { valueAsNumber: true })}
      />
    </StepLayout>
  )
}
