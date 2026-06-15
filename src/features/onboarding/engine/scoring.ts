import type { Question, QuestionsIDs } from '../api/types'

export interface UserAnswer {
  answerId?: number
  answerLabel?: string
  others?: string
  score: number
}

export const getUserAnswers = (
  questions: Question[],
  details: QuestionsIDs[] = []
): Record<string, UserAnswer> => {
  const result: Record<string, UserAnswer> = {}
  for (const detail of details) {
    const question = questions.find((q) => q.id === detail.question)
    if (!question) continue
    const answer = question.answers.find((a) => a.id === detail.answer)
    result[question.label] = {
      answerId: answer?.id,
      answerLabel: answer?.label,
      others: detail.others,
      score: answer?.score ?? 0,
    }
  }
  return result
}

export const scoreAssessment = (
  questions: Question[],
  details: QuestionsIDs[] = [],
  labels: string[]
): number => {
  const answers = getUserAnswers(questions, details)
  return labels.reduce((acc, label) => acc + (answers[label]?.score ?? 0), 0)
}

export const scoreAll = (questions: Question[], details: QuestionsIDs[] = []): number =>
  Object.values(getUserAnswers(questions, details)).reduce((acc, a) => acc + (a.score ?? 0), 0)
