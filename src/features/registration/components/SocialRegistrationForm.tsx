import { useEffect, useMemo, useState } from 'react'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack, TextField, MenuItem, FormControlLabel, Checkbox } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useCountries } from '../api/countriesQueries'
import { filterCountries, domainForCountry, organizationIdForCountry, getLanguageId } from '../country'
import { useRegistrationStore } from '../state/registrationStore'
import { useOnboardingStore } from '@/features/onboarding/state/onboardingStore'
import { createSocialAccount } from '../api/createAccount'

const CURRENT_YEAR = new Date().getFullYear()

const makeSchema = (needsName: boolean) => {
  const nameField = needsName ? z.string().min(1, 'Required') : z.string().optional()
  const dob = (max: number) =>
    needsName ? z.coerce.number().int().min(1).max(max) : z.coerce.number().int().min(1).max(max).optional()
  return z.object({
    countryId: z.number().int().positive('Select your country of residence'),
    agreeToTerms: z.literal(true, { message: 'You must accept the terms' }),
    marketingConsent: z.boolean(),
    firstName: nameField,
    lastName: nameField,
    day: dob(31),
    month: dob(12),
    year: needsName ? z.coerce.number().int().min(1900).max(CURRENT_YEAR) : z.coerce.number().int().min(1900).max(CURRENT_YEAR).optional(),
  })
}

export const SocialRegistrationForm = () => {
  const navigate = useNavigate()
  const social = useRegistrationStore((s) => s.socialDraft)
  const clearSocial = useRegistrationStore((s) => s.clearSocial)
  const seedOnboarding = useOnboardingStore((s) => s.patch)
  const { data: countryData } = useCountries()
  const countries = useMemo(() => filterCountries(countryData ?? []), [countryData])
  const needsName = !social?.firstName || !social?.lastName
  const [submitError, setSubmitError] = useState(false)

  const methods = useForm({
    resolver: zodResolver(makeSchema(needsName)),
    defaultValues: { countryId: 0, marketingConsent: false, firstName: '', lastName: '' },
  })

  useEffect(() => {
    if (!social) navigate({ to: '/account/register' })
  }, [social, navigate])

  const onSubmit = methods.handleSubmit(async (v) => {
    if (!social) return
    const country = countries.find((c) => c.id === v.countryId)
    if (!country) return
    setSubmitError(false)
    try {
      const firstName = social.firstName ?? (v.firstName as string) ?? ''
      const lastName = social.lastName ?? (v.lastName as string) ?? ''
      const portalAccountDomain = domainForCountry(country)
      const { applicationId } = await createSocialAccount({
        social,
        originCountry: country.id,
        preferredOrganization: organizationIdForCountry(country),
        portalAccountDomain,
        preferredLanguage: getLanguageId(country, [], 'en'),
        firstName,
        lastName,
        title: 'Mr',
        agreeToAllTerms: true,
        isMarketingOptOut: !v.marketingConsent,
        day: v.day as number | undefined,
        month: v.month as number | undefined,
        year: v.year as number | undefined,
      })
      seedOnboarding({
        applicationId,
        originCountry: country.id,
        portalAccountDomain,
        accountHolderFirstName: firstName,
        accountHolderLastName: lastName,
        ...(v.day ? { accountHolderDayOfBirth: v.day as number } : {}),
        ...(v.month ? { accountHolderMonthOfBirth: v.month as number } : {}),
        ...(v.year ? { accountHolderYearOfBirth: v.year as number } : {}),
      })
      clearSocial()
      navigate({ to: '/onboarding' })
    } catch {
      setSubmitError(true)
    }
  })

  return (
    <AuthCard title="Complete your registration">
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <Stack spacing={2} sx={{ maxWidth: 360 }}>
            {needsName && (
              <>
                <RHFTextField name="firstName" label="First name" />
                <RHFTextField name="lastName" label="Last name" />
                <RHFTextField name="day" label="Day" type="number" />
                <RHFTextField name="month" label="Month" type="number" />
                <RHFTextField name="year" label="Year" type="number" />
              </>
            )}
            <Controller
              control={methods.control}
              name="countryId"
              render={({ field, fieldState }) => (
                <TextField
                  select
                  id="countryId"
                  label="Country of residence"
                  value={field.value || ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {countries.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              )}
            />
            {/* C-2 pre-production compliance blocker: link the real T&C / Client Agreement / KID documents once compliance supplies them. */}
            <Controller
              control={methods.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox checked={field.value === true} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} />
                  }
                  label="I agree to the Terms and Conditions"
                />
              )}
            />
            {methods.formState.errors.agreeToTerms && (
              <Box sx={{ color: 'error.main', fontSize: 12 }}>{methods.formState.errors.agreeToTerms.message as string}</Box>
            )}
            <FormControlLabel
              control={<Checkbox {...methods.register('marketingConsent')} />}
              label="Send me marketing updates"
            />
            {submitError && (
              <Box sx={{ color: 'error.main', fontSize: 12 }}>We could not create your account. Please try again.</Box>
            )}
            <Button type="submit">Continue</Button>
          </Stack>
        </Box>
      </FormProvider>
    </AuthCard>
  )
}
