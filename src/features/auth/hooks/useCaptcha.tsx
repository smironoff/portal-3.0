import { useCallback, useMemo, useRef } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { useConfig } from '@/config/ConfigProvider'

// Invisible hCaptcha. Returns the element to render and an async executor that
// resolves to a token (empty string when no site key is configured).
export const useCaptcha = () => {
  const config = useConfig()
  const ref = useRef<HCaptcha>(null)
  const siteKey = config.HCAPTCHA_KEY

  const element = useMemo(
    () => (siteKey ? <HCaptcha ref={ref} sitekey={siteKey} size="invisible" /> : null),
    [siteKey]
  )

  const execute = useCallback(async (): Promise<string> => {
    if (!siteKey || !ref.current) return ''
    const res = await ref.current.execute({ async: true })
    return res?.response ?? ''
  }, [siteKey])

  const reset = useCallback(() => ref.current?.resetCaptcha(), [])

  return { element, execute, reset }
}
