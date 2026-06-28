import { useState, useMemo } from 'react'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack, TextField, MenuItem, FormControlLabel, Checkbox } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useCountries } from '../api/countriesQueries'
import { filterCountries, domainForCountry, organizationIdForCountry, getLanguageId } from '../country'
import { useRegistrationStore } from '../state/registrationStore'
import { readTracking } from '../tracking'

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number')

const schema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    countryId: z.number().int().positive('Select your country of residence'),
    agreeToTerms: z.literal(true, { message: 'You must accept the terms' }),
    marketingConsent: z.boolean(),
    ibCode: z.string().max(20, 'Introducer code is too long').regex(/^[A-Za-z0-9]*$/, 'Introducer code must be alphanumeric'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type Values = z.infer<typeof schema>

export const RegisterForm = () => {
  const [step, setStep] = useState(0)
  const [tracking] = useState(readTracking)
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      countryId: 0,
      marketingConsent: false,
      ibCode: tracking.afsAid ?? '',
    },
  })
  const { data: countryData } = useCountries()
  const countries = useMemo(() => filterCountries(countryData ?? []), [countryData])
  const setDraft = useRegistrationStore((s) => s.setDraft)
  const navigate = useNavigate()

  const goNext = async () => {
    if (await methods.trigger(['email', 'password', 'confirmPassword'])) setStep(1)
  }

  const onSubmit = (v: Values) => {
    const country = countries.find((c) => c.id === v.countryId)
    if (!country) return
    setDraft({
      email: v.email,
      password: v.password,
      originCountry: country.id,
      preferredOrganization: organizationIdForCountry(country),
      portalAccountDomain: domainForCountry(country),
      preferredLanguage: getLanguageId(country, [], 'en'),
      agreeToAllTerms: true,
      isMarketingOptOut: !v.marketingConsent,
    })
    navigate({ to: '/account/personal-information' })
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          {step === 0 && (
            <>
              <RHFTextField name="email" label="Email" type="email" autoComplete="username" />
              <RHFTextField name="password" label="Password" type="password" autoComplete="new-password" />
              <RHFTextField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />
              <Button type="button" onClick={goNext}>Next</Button>
            </>
          )}
          {step === 1 && (
            <>
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
              <RHFTextField name="ibCode" label="Introducer code (optional)" />
              {/* C-2 pre-production compliance blocker: link to the real T&C / Client Agreement / KID documents once compliance supplies them. */}
              <Controller
                control={methods.control}
                name="agreeToTerms"
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value === true}
                        onChange={(e) => field.onChange(e.target.checked)}
                        onBlur={field.onBlur}
                      />
                    }
                    label="I agree to the Terms and Conditions"
                  />
                )}
              />
              {methods.formState.errors.agreeToTerms && (
                <Box sx={{ color: 'error.main', fontSize: 12 }}>{methods.formState.errors.agreeToTerms.message}</Box>
              )}
              <FormControlLabel
                control={<Checkbox {...methods.register('marketingConsent')} />}
                label="Send me marketing updates"
              />
              <Stack direction="row" spacing={1}>
                <Button type="button" variant="text" onClick={() => setStep(0)}>Back</Button>
                <Button type="submit">Continue</Button>
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </FormProvider>
  )
}
