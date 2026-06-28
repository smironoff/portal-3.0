import { useEffect, useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useCaptcha } from '@/features/auth/hooks/useCaptcha'
import { useRegistrationStore } from '../state/registrationStore'
import { useOnboardingStore } from '@/features/onboarding/state/onboardingStore'
import { createSimplifiedAccount } from '../api/createAccount'

const CURRENT_YEAR = new Date().getFullYear()

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  day: z.coerce.number().int().min(1).max(31),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1900).max(CURRENT_YEAR),
})
type Values = z.infer<typeof schema>

export const PersonalInformationForm = () => {
  const navigate = useNavigate()
  const draft = useRegistrationStore((s) => s.draft)
  const clearDraft = useRegistrationStore((s) => s.clear)
  const seedOnboarding = useOnboardingStore((s) => s.patch)
  const captcha = useCaptcha()
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '' },
  })

  useEffect(() => {
    if (!draft) navigate({ to: '/account/register' })
  }, [draft, navigate])

  const onSubmit = useMemo(
    () =>
      methods.handleSubmit(async (v) => {
        if (!draft) return
        try {
          const token = await captcha.execute()
          const { applicationId } = await createSimplifiedAccount({
            ...draft,
            firstName: v.firstName,
            lastName: v.lastName,
            day: v.day,
            month: v.month,
            year: v.year,
            title: 'Mr',
            recaptchaResponse: token,
          })
          seedOnboarding({
            applicationId,
            originCountry: draft.originCountry,
            portalAccountDomain: draft.portalAccountDomain,
            accountHolderFirstName: v.firstName,
            accountHolderLastName: v.lastName,
            accountHolderDayOfBirth: v.day,
            accountHolderMonthOfBirth: v.month,
            accountHolderYearOfBirth: v.year,
          })
          clearDraft()
          navigate({ to: '/onboarding' })
        } catch {
          captcha.reset()
          methods.setError('firstName', { message: 'We could not create your account. Please try again.' })
        }
      }),
    [methods, draft, captcha, seedOnboarding, clearDraft, navigate]
  )

  return (
    <AuthCard title="Personal information">
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <Stack spacing={2}>
            <RHFTextField name="firstName" label="First name" />
            <RHFTextField name="lastName" label="Last name" />
            <RHFTextField name="day" label="Day" type="number" />
            <RHFTextField name="month" label="Month" type="number" />
            <RHFTextField name="year" label="Year" type="number" />
            <Button type="submit">Continue</Button>
            {captcha.element}
          </Stack>
        </Box>
      </FormProvider>
    </AuthCard>
  )
}
