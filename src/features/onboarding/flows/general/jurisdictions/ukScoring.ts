import {
  UK,
  UK_FOREX_PASS_ANSWERS,
  UK_SHARES_EXPERIENCE_ANSWERS,
  UK_DEPOSIT_LOSS_PASS_ANSWERS,
  UK_REFER_THRESHOLD_WITH_SHARES,
  UK_REFER_THRESHOLD_WITHOUT_SHARES,
} from '../constants'
import type { UserAnswer } from '../../../engine/scoring'

type Level = 'PASS' | 'REFER' | 'FAIL'
type Answers = Record<string, UserAnswer>

export const applyDepositLossGate = (level: Level, depositLossAnswer?: string): Level =>
  level === 'PASS' && depositLossAnswer && !UK_DEPOSIT_LOSS_PASS_ANSWERS.includes(depositLossAnswer)
    ? 'REFER'
    : level

export const forexAutoPass = (answers: Answers): Level | undefined => {
  const forex = answers[UK.forexExperience]?.answerLabel
  return forex && UK_FOREX_PASS_ANSWERS.includes(forex)
    ? applyDepositLossGate('PASS', answers[UK.UKDepositLoss]?.answerLabel)
    : undefined
}

// NOTE: `futuresOptionsExperience` is asked on the no-forex path but is NOT summed
// into the score — this matches the legacy UK flow (collected for the audit trail, not
// scored). TODO(compliance): confirm it is intentionally audit-only and not a scoring input.
export const computeUkLevel = (answers: Answers): Level => {
  const forex = answers[UK.forexExperience]?.answerLabel
  let level: Level = 'FAIL'
  if (forex && UK_FOREX_PASS_ANSWERS.includes(forex)) {
    level = 'PASS'
  } else if (forex === 'never') {
    const hasShares = UK_SHARES_EXPERIENCE_ANSWERS.includes(answers[UK.sharesFundsExperience]?.answerLabel ?? '')
    const score = hasShares
      ? (answers[UK.personalProfit]?.score ?? 0) + (answers[UK.useLeverage]?.score ?? 0)
      : (answers[UK.personalProfit]?.score ?? 0) +
        (answers[UK.useLeverage]?.score ?? 0) +
        (answers[UK.unwantedMarketMovements]?.score ?? 0) +
        (answers[UK.appleUseLeverage]?.score ?? 0)
    const threshold = hasShares ? UK_REFER_THRESHOLD_WITH_SHARES : UK_REFER_THRESHOLD_WITHOUT_SHARES
    if (score > threshold) level = 'REFER'
  }
  return applyDepositLossGate(level, answers[UK.UKDepositLoss]?.answerLabel)
}
