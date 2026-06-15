import { useQuestions } from '../../api/onboardingQueries'
import { useOnboardingStore } from '../../state/onboardingStore'

// The org id is carried on the application draft once loaded; undefined disables the query.
// TODO confirm org id source — AppInfo has an index signature so organizationId compiles;
// verify the actual field name from the API response.
export const useQuestionsList = () => {
  const orgId = useOnboardingStore((s) => s.draft.organizationId as number | undefined)
  return useQuestions(orgId).data ?? []
}
