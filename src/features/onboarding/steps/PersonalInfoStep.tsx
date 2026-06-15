import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const computeAge = (day: number, month: number, year: number): number => {
  const today = new Date()
  let age = today.getFullYear() - year
  const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day)
  if (!hadBirthday) age -= 1
  return age
}

const schema = z
  .object({
    accountHolderFirstName: z.string().min(1, 'First name is required'),
    accountHolderLastName: z.string().min(1, 'Last name is required'),
    accountHolderDayOfBirth: z.number().int().min(1).max(31),
    accountHolderMonthOfBirth: z.number().int().min(1).max(12),
    accountHolderYearOfBirth: z.number().int().min(1900),
  })
  .superRefine((v, ctx) => {
    if (computeAge(v.accountHolderDayOfBirth, v.accountHolderMonthOfBirth, v.accountHolderYearOfBirth) < 18) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must be at least 18',
        path: ['accountHolderYearOfBirth'],
      })
    }
  })
type Values = z.infer<typeof schema>

export const PersonalInfoStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountHolderFirstName: draft.accountHolderFirstName ?? '',
      accountHolderLastName: draft.accountHolderLastName ?? '',
      accountHolderDayOfBirth: draft.accountHolderDayOfBirth,
      accountHolderMonthOfBirth: draft.accountHolderMonthOfBirth,
      accountHolderYearOfBirth: draft.accountHolderYearOfBirth,
    },
  })
  const submit = handleSubmit((v) => {
    patch(v)
    onNext()
  })
  return (
    <StepLayout title="Personal information" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <TextField
        label="First name"
        error={!!errors.accountHolderFirstName}
        helperText={errors.accountHolderFirstName?.message}
        {...register('accountHolderFirstName')}
      />
      <TextField
        label="Last name"
        error={!!errors.accountHolderLastName}
        helperText={errors.accountHolderLastName?.message}
        {...register('accountHolderLastName')}
      />
      <TextField
        label="Day"
        type="number"
        {...register('accountHolderDayOfBirth', { valueAsNumber: true })}
      />
      <TextField
        label="Month"
        type="number"
        {...register('accountHolderMonthOfBirth', { valueAsNumber: true })}
      />
      <TextField
        label="Year"
        type="number"
        error={!!errors.accountHolderYearOfBirth}
        helperText={errors.accountHolderYearOfBirth?.message}
        {...register('accountHolderYearOfBirth', { valueAsNumber: true })}
      />
    </StepLayout>
  )
}
