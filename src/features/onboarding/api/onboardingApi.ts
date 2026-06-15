import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import type { AppInfo, Question, IncrementalSubmitResponse, SubmitLevelResponse } from './types'

export const loadApplication = async (): Promise<AppInfo | undefined> => {
  const res = await getHttpClient().tfboCall<AppInfo[]>('application', 'getLastApplicationsInfo', {}, Authorize.Yes)
  const apps = res.payload?.[0]?.result
  return Array.isArray(apps) ? apps[apps.length - 1] : undefined
}

export const getQuestions = async (orgId: number): Promise<Question[]> => {
  const res = await getHttpClient().tfboCall<Question[]>('application', 'getQuestions', { orgId }, Authorize.No)
  return res.payload?.[0]?.result ?? []
}

export const incrementalSubmit = async (app: Partial<AppInfo>): Promise<IncrementalSubmitResponse> => {
  const res = await getHttpClient().tfboCall<IncrementalSubmitResponse>('application', 'application_submit', app, Authorize.Yes)
  return res.payload[0]!.result
}

export const submitLevelOne = async (app: Partial<AppInfo>): Promise<SubmitLevelResponse> => {
  const res = await getHttpClient().tfboCall<SubmitLevelResponse>('application', 'simplified_submit_level_one', app, Authorize.Yes)
  return res.payload[0]!.result
}

export const submitLevelTwo = async (app: Partial<AppInfo>): Promise<SubmitLevelResponse> => {
  const res = await getHttpClient().tfboCall<SubmitLevelResponse>('application', 'simplified_submit_level_two', app, Authorize.Yes)
  return res.payload[0]!.result
}
