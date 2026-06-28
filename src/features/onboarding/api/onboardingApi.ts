import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import type { APIResponse } from '@/api/envelope'
import type { AppInfo, Question, IncrementalSubmitResponse, SubmitLevelResponse, ApplicationStatusResponse } from './types'

const unwrap = <T>(res: APIResponse<T>): T => {
  const item = res.payload?.[0]
  if (!item || item.status !== 'OK') {
    throw new Error(item?.message ?? `Application request failed: ${item?.status ?? 'empty response'}`)
  }
  return item.result
}

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
  return unwrap(res)
}

export const submitLevelOne = async (app: Partial<AppInfo>): Promise<SubmitLevelResponse> => {
  const res = await getHttpClient().tfboCall<SubmitLevelResponse>('application', 'simplified_submit_level_one', app, Authorize.Yes)
  return unwrap(res)
}

export const submitLevelTwo = async (app: Partial<AppInfo>): Promise<SubmitLevelResponse> => {
  const res = await getHttpClient().tfboCall<SubmitLevelResponse>('application', 'simplified_submit_level_two', app, Authorize.Yes)
  return unwrap(res)
}

export const loadApplicationStatuses = async (): Promise<ApplicationStatusResponse[]> => {
  const res = await getHttpClient().tfboCall<ApplicationStatusResponse[]>('application', 'check_application_statuses', {}, Authorize.Yes)
  const statuses = res.payload?.[0]?.result
  return Array.isArray(statuses) ? statuses : []
}
