import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = { tfboCall: vi.fn(), auth: vi.fn(), tfbo: vi.fn(), request: vi.fn() }
vi.mock('@/api/client', () => ({ getHttpClient: () => http }))

beforeEach(() => http.tfboCall.mockReset())

describe('onboardingApi', () => {
  it('loadApplication returns the most recent application', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: [{ applicationId: 1, status: 'INCOMPLETE' }] }] })
    const { loadApplication } = await import('./onboardingApi')
    const app = await loadApplication()
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'getLastApplicationsInfo', {}, 0)
    expect(app?.status).toBe('INCOMPLETE')
  })

  it('getQuestions passes orgId unauthenticated', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: [] }] })
    const { getQuestions } = await import('./onboardingApi')
    await getQuestions(5)
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'getQuestions', { orgId: 5 }, 1)
  })

  it('incrementalSubmit posts application_submit and returns the status', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: { applicationStatus: 'INCOMPLETE', applicationId: 1 } }] })
    const { incrementalSubmit } = await import('./onboardingApi')
    const res = await incrementalSubmit({ accountHolderFirstName: 'Jo' })
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'application_submit', { accountHolderFirstName: 'Jo' }, 0)
    expect(res.applicationStatus).toBe('INCOMPLETE')
  })

  it('submitLevelOne / submitLevelTwo post the right actions', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: { applicationId: 1 } }] })
    const { submitLevelOne, submitLevelTwo } = await import('./onboardingApi')
    await submitLevelOne({ applicationId: 1 })
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'simplified_submit_level_one', { applicationId: 1 }, 0)
    await submitLevelTwo({ applicationId: 1 })
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'simplified_submit_level_two', { applicationId: 1 }, 0)
  })
})
