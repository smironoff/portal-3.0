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
import { useRequestPasswordReset } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { useNotificationStore } from '@/state/notificationStore'

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({ email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')) })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const PasswordResetRequestForm = () => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const request = useRequestPasswordReset()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    try {
      const token = await captcha.execute()
      const ok = await request.mutateAsync({ email: v.email, captcha: token })
      if (ok) navigate({ to: '/account/reset/sent', search: { email: v.email } })
      else {
        notify({ severity: 'error', message: 'auth.error.resetFailed' })
        captcha.reset()
      }
    } catch {
      notify({ severity: 'error', message: 'auth.error.resetFailed' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="email" label={t('reset.request.email')} type="email" />
          <Button type="submit" disabled={request.isPending}>
            {t('reset.request.submit')}
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
