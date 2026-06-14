import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

export const useInactivityTimeout = (opts: {
  minutes: number
  enabled: boolean
  onTimeout: () => void
}) => {
  const { minutes, enabled, onTimeout } = opts
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
  })

  useEffect(() => {
    if (!enabled) return
    const ms = minutes * 60_000
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => onTimeoutRef.current(), ms)
    }
    reset()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [minutes, enabled])
}
