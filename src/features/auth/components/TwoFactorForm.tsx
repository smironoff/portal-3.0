import { useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useVerifyTwoFactor } from '../api/authQueries'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { getUserProfile } from '../api/authApi'
import { resolveLandingRoute } from '../landing'

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({ code: z.string().regex(/^\d{6}$/, t('validation.codeFormat')) })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const TwoFactorForm = ({ email }: { email: string }) => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '' } })
  const verify = useVerifyTwoFactor()
  const navigate = useNavigate()

  const onSubmit = async (v: Values) => {
    try {
      const res = await verify.mutateAsync({ email, code: v.code })
      if (res.status === 'OK' && res.tokens) {
        tokenStore.setAuthTokens(res.tokens)
        useSessionStore.getState().setLoggedIn(true)
        const profile = await getUserProfile().catch(() => undefined)
        navigate({ to: resolveLandingRoute(profile) })
        return
      }
      if (res.code === 'ASE-002') {
        useSessionStore.getState().reset()
        tokenStore.clear()
        navigate({ to: '/account/login', search: { error: 'tfa_expired' } })
        return
      }
      methods.setError('code', { message: t('twoFactor.invalidCode') })
    } catch {
      methods.setError('code', { message: t('twoFactor.verificationFailed') })
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 280 }}>
          <RHFTextField name="code" label={t('twoFactor.code')} inputMode="numeric" autoFocus />
          <Button type="submit" disabled={verify.isPending}>
            {t('twoFactor.verify')}
          </Button>
        </Stack>
      </Box>
    </FormProvider>
  )
}
