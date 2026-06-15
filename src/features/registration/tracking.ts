export interface TrackingData {
  afsAid?: string
  utmLink?: string
  source: string
  visitorId?: string
  referrerId?: string
}

const readCookie = (name: string): string | undefined => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

export const readTracking = (): TrackingData => {
  let afsAid: string | undefined
  const ibc = readCookie('ibc')
  if (ibc) {
    try {
      const parsed = JSON.parse(ibc) as { pid?: number }
      if (parsed.pid != null) afsAid = String(parsed.pid)
    } catch {
      // malformed cookie -> ignore
    }
  }
  const rawVisitorId = (window as { visitorId?: string }).visitorId
  const visitorId = typeof rawVisitorId === 'string' && rawVisitorId.length < 100 ? rawVisitorId : undefined
  return {
    afsAid,
    utmLink: sessionStorage.getItem('utmLink') ?? undefined,
    source: sessionStorage.getItem('parsedSource') ?? 'TP3-LiveApp',
    visitorId,
    referrerId: readCookie('referrerId'),
  }
}
