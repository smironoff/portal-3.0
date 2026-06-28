import '@testing-library/jest-dom/vitest'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '../../public/locales/en/common.json'
import auth from '../../public/locales/en/auth.json'

// Synchronous, in-memory i18n for tests: useTranslation() resolves real English
// without the HTTP backend or a provider, so existing English assertions hold.
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'auth'],
  defaultNS: 'common',
  resources: { en: { common, auth } },
  interpolation: { escapeValue: false },
})
