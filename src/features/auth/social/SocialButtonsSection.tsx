import { Stack, Divider } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { SocialButton } from './SocialButton'

export const SocialButtonsSection = () => {
  const { t } = useTranslation('auth')
  return (
    <Stack spacing={1}>
      <Divider>{t('social.divider')}</Divider>
      <SocialButton provider="google" />
      <SocialButton provider="apple" />
    </Stack>
  )
}
