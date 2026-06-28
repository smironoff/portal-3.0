import { useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack, FormControlLabel, Checkbox } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useLogin } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { useNotificationStore } from '@/state/notificationStore'
import { keepSignedIn } from '../keepSignedIn'
import { resolveLandingRoute } from '../landing'
import { getUserProfile } from '../api/authApi'
import { LOGGED_IN_STATUSES } from '../api/authTypes'
import { aseCodeToMessageKey } from '../api/aseCodes'

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({
    email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')),
    password: z.string().min(1, t('validation.passwordRequired')),
    keepSignedIn: z.boolean(),
  })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const LoginForm = () => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', keepSignedIn: false },
  })
  const login = useLogin()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    try {
      const token = await captcha.execute()
      const res = await login.mutateAsync({ email: v.email, password: v.password, captcha: token })

      if (res.status === 'TFA_REQUIRED' && res.tokens) {
        tokenStore.setAuthTokens(res.tokens)
        keepSignedIn.set(v.keepSignedIn)
        navigate({ to: '/account/login/check', search: { email: v.email } })
        return
      }
      if (res.code === 'ASE-001') {
        methods.setError('password', { message: t('login.invalidCredentials') })
        captcha.reset()
        return
      }
      if (res.status && LOGGED_IN_STATUSES.includes(res.status as never) && res.tokens) {
        tokenStore.setAuthTokens(res.tokens)
        keepSignedIn.set(v.keepSignedIn)
        useSessionStore.getState().setLoggedIn(true)
        const profile = await getUserProfile().catch(() => undefined)
        navigate({ to: resolveLandingRoute(profile) })
        return
      }
      notify({ severity: 'error', message: aseCodeToMessageKey(res.code) })
      captcha.reset()
    } catch {
      notify({ severity: 'error', message: 'auth.error.generic' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="email" label={t('login.email')} type="email" autoComplete="username" />
          <RHFTextField
            name="password"
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
          />
          <FormControlLabel
            control={<Checkbox {...methods.register('keepSignedIn')} />}
            label={t('login.keepSignedIn')}
          />
          <Button type="submit" disabled={login.isPending}>
            {t('login.signIn')}
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
