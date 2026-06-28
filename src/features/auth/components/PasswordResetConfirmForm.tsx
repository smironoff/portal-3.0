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
import { useConfirmPasswordReset } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { useNotificationStore } from '@/state/notificationStore'

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({ password: z.string().min(8, t('validation.passwordMinLength')) })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const PasswordResetConfirmForm = ({ token }: { token: string }) => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '' } })
  const confirm = useConfirmPasswordReset()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    try {
      const captchaToken = await captcha.execute()
      const ok = await confirm.mutateAsync({ password: v.password, token, captcha: captchaToken })
      if (ok) navigate({ to: '/account/reset/done' })
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
          <RHFTextField name="password" label={t('reset.confirm.password')} type="password" autoComplete="new-password" />
          <Button type="submit" disabled={confirm.isPending}>
            {t('reset.confirm.submit')}
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
