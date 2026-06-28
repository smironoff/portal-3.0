import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from './onboardingApi'
import type { AppInfo } from './types'

export const useApplication = (enabled: boolean) =>
  useQuery({ queryKey: ['application'], queryFn: api.loadApplication, enabled })

export const useQuestions = (orgId: number | undefined) =>
  useQuery({ queryKey: ['questions', orgId], queryFn: () => api.getQuestions(orgId!), enabled: orgId != null })

export const useIncrementalSubmit = () =>
  useMutation({ mutationFn: (app: Partial<AppInfo>) => api.incrementalSubmit(app) })

export const useSubmitLevelOne = () =>
  useMutation({ mutationFn: (app: Partial<AppInfo>) => api.submitLevelOne(app) })

export const useSubmitLevelTwo = () =>
  useMutation({ mutationFn: (app: Partial<AppInfo>) => api.submitLevelTwo(app) })

export const useApplicationStatuses = (enabled: boolean) =>
  useQuery({ queryKey: ['applicationStatuses'], queryFn: api.loadApplicationStatuses, enabled })
