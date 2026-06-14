import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useRequestPasswordReset } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { useNotificationStore } from '@/state/notificationStore'

const schema = z.object({ email: z.string().min(1, 'Email is required').email('Enter a valid email') })
type Values = z.infer<typeof schema>

export const PasswordResetRequestForm = () => {
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const request = useRequestPasswordReset()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    const token = await captcha.execute()
    const ok = await request.mutateAsync({ email: v.email, captcha: token })
    if (ok) navigate({ to: '/account/reset/sent', search: { email: v.email } } as never)
    else {
      notify({ severity: 'error', message: 'auth.error.resetFailed' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="email" label="Email" type="email" />
          <Button type="submit" disabled={request.isPending}>
            Send reset link
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
