import 'i18next'
import type common from '../../public/locales/en/common.json'
import type auth from '../../public/locales/en/auth.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof common
      auth: typeof auth
    }
  }
}
