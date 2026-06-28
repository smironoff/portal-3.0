import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ChainedBackend from 'i18next-chained-backend'
import HttpBackend from 'i18next-http-backend'
import LocalStorageBackend from 'i18next-localstorage-backend'

export const initI18n = (defaultLanguage: string, buildVersion: string) => {
  return i18n
    .use(ChainedBackend)
    .use(initReactI18next)
    .init({
      lng: defaultLanguage,
      fallbackLng: 'en',
      ns: ['common', 'auth'],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      backend: {
        backends: [LocalStorageBackend, HttpBackend],
        backendOptions: [
          { expirationTime: 24 * 60 * 60 * 1000 },
          { loadPath: `/locales/{{lng}}/{{ns}}.json?v=${buildVersion}` },
        ],
      },
    })
}

export default i18n
