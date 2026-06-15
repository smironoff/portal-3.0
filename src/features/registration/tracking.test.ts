import { describe, it, expect, beforeEach } from 'vitest'
import { readTracking } from './tracking'

describe('readTracking', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.cookie = 'ibc=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'referrerId=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    delete (window as { visitorId?: string }).visitorId
  })
  it('defaults source and leaves optional fields undefined', () => {
    const t = readTracking()
    expect(t.source).toBe('TP3-LiveApp')
    expect(t.afsAid).toBeUndefined()
    expect(t.utmLink).toBeUndefined()
    expect(t.visitorId).toBeUndefined()
    expect(t.referrerId).toBeUndefined()
  })

  it('reads the ibc cookie pid, utm/source, visitorId and referrerId', () => {
    document.cookie = `ibc=${encodeURIComponent(JSON.stringify({ type: 'retail', pid: 42 }))}`
    document.cookie = 'referrerId=ref-9'
    sessionStorage.setItem('utmLink', '?utm_source=x')
    sessionStorage.setItem('parsedSource', 'CustomSource')
    ;(window as { visitorId?: string }).visitorId = 'v-1'
    const t = readTracking()
    expect(t.afsAid).toBe('42')
    expect(t.utmLink).toBe('?utm_source=x')
    expect(t.source).toBe('CustomSource')
    expect(t.visitorId).toBe('v-1')
    expect(t.referrerId).toBe('ref-9')
  })

  it('ignores a malformed ibc cookie', () => {
    document.cookie = 'ibc=not-json'
    expect(readTracking().afsAid).toBeUndefined()
  })

  it('ignores an ibc cookie with no pid', () => {
    document.cookie = `ibc=${encodeURIComponent(JSON.stringify({ type: 'retail' }))}`
    expect(readTracking().afsAid).toBeUndefined()
  })
})
