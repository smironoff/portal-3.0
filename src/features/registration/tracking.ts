export interface TrackingData {
  afsAid?: string
  utmLink?: string
  source: string
  visitorId?: string
  referrerId?: string
}

const readCookie = (name: string): string | undefined => {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
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
  return {
    afsAid,
    utmLink: sessionStorage.getItem('utmLink') ?? undefined,
    source: sessionStorage.getItem('parsedSource') ?? 'TP3-LiveApp',
    visitorId: (window as { visitorId?: string }).visitorId,
    referrerId: readCookie('referrerId'),
  }
}
