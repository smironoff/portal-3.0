// AU assessment question labels (verbatim from legacy AU_Questions; note the
// KOQRiskAppetite VALUE differs from its key).
export const AU = {
  KOQHardship: 'KOQHardship',
  KOQHoldCFD: 'KOQHoldCFD',
  KOQCFDAccount: 'KOQCFDAccount',
  NKOQRiskAmount: 'NKOQRiskAmount',
  KOQRiskAppetite: 'KOQRiskAppetiteCFD',
  KOQRiskFinancial: 'KOQRiskFinancial',
  KOQLosingTrade: 'KOQLosingTrade',
  KOQVulnerability: 'KOQVulnerability',
} as const

// The mandatory KOQ assessment questions shown in order (KOQHardship first).
export const AU_KOQ_LABELS: string[] = [
  AU.KOQHardship,
  AU.KOQHoldCFD,
  AU.KOQCFDAccount,
  AU.NKOQRiskAmount,
  AU.KOQRiskAppetite,
  AU.KOQRiskFinancial,
  AU.KOQLosingTrade,
  AU.KOQVulnerability,
]

export const AU_PASS_THRESHOLD = 8

export const EMPLOYMENT_OPTIONS = [
  { label: 'Employed', value: 'Employed' },
  { label: 'Self employed', value: 'Self employed' },
  { label: 'Unemployed', value: 'Unemployed' },
  { label: 'Retired', value: 'Retired' },
  { label: 'Student', value: 'Student' },
  { label: 'Other', value: 'Others' },
]
// Employment statuses that require employer details.
export const EMPLOYED_VALUES = ['Employed', 'Self employed']

export const AU_MONEY_OPTIONS = [
  { label: '500,000+', value: '500,000+' },
  { label: '250,001 - 500,000', value: '250,001 - 500,000' },
  { label: '150,001 - 250,000', value: '150,001 - 250,000' },
  { label: '75,001 - 150,000', value: '75,001 - 150,000' },
  { label: '35,001 - 75,000', value: '35,001 - 75,000' },
  { label: '20,001 - 35,000', value: '20,001 - 35,000' },
  { label: 'Less than 20,000', value: '< 20,000' },
]

export const AU_SOURCE_OF_FUNDS_OPTIONS = [
  { label: 'Employment', value: 'Employment' },
  { label: 'Self-employment', value: 'Self-employment' },
  { label: 'Inheritance', value: 'Inheritance' },
  { label: 'Savings and Investments', value: 'Savings and Investments' },
  { label: 'Social security payments and/or borrowings', value: 'Social security payments and/or borrowings' },
  { label: 'Passive income', value: 'Passive income' },
]

export const AU_CONTACT_US_LINK = 'https://www.thinkmarkets.com/au/support/contact-us/'
export const TMCY_CONTACT_US_LINK = 'https://www.thinkmarkets.com/eu/support/contact-us/' // TODO confirm exact CY/EU support URL with compliance

export const TMCY = {
  sourceWealth: 'sourceWealth',
  turnover: 'turnover',
  incomingFunds: 'incomingFunds',
  education: 'education',
  describeTradingStrategy: 'describeTradingStrategy',
  futuresOptionsExperience: 'futuresOptionsExperience',
  executedMoreThan10CFDTrades: 'executedMoreThan10CFDTrades',
  personalProfit: 'personalProfit',
  useLeverage: 'useLeverage',
  unwantedMarketMovements: 'unwantedMarketMovements',
  appleStocknearMinimumRequiredBalance: 'appleStocknearMinimumRequiredBalance',
  describeHighVolatility: 'describeHighVolatility',
} as const

// Ordered TMCY assessment/income questions rendered as steps (the last carries scoring).
export const TMCY_QUESTION_LABELS: string[] = [
  TMCY.sourceWealth,
  TMCY.turnover,
  TMCY.incomingFunds,
  TMCY.education,
  TMCY.describeTradingStrategy,
  TMCY.futuresOptionsExperience,
  TMCY.executedMoreThan10CFDTrades,
  TMCY.personalProfit,
  TMCY.useLeverage,
  TMCY.unwantedMarketMovements,
  TMCY.appleStocknearMinimumRequiredBalance,
  TMCY.describeHighVolatility,
]

export const TMCY_PASS_THRESHOLD = 21
export const TMCY_REFER_THRESHOLD = 11

export const UK = {
  forexExperience: 'forexExperience',
  sharesFundsExperience: 'sharesFundsExperience',
  futuresOptionsExperience: 'futuresOptionsExperience',
  personalProfit: 'personalProfit',
  useLeverage: 'useLeverage',
  unwantedMarketMovements: 'unwantedMarketMovements',
  appleUseLeverage: 'appleUseLeverage',
  UKDepositLoss: 'UKDepositLoss',
} as const

export const UK_FOREX_PASS_ANSWERS = ['moreThan60Trades', 'between11and60Trades', 'between1and10Trades']
export const UK_SHARES_EXPERIENCE_ANSWERS = ['moreThan60Trades', 'between11and60Trades', 'lessThan10Trades']
export const UK_DEPOSIT_LOSS_PASS_ANSWERS = ['UKDepositLoss1', 'UKDepositLoss2']
// Score > threshold -> REFER (else FAIL). Values ported verbatim from the legacy
// UK flow (UK_APPR_TEST_REFER_THRESHOLD_WITH/WITHOUT_SHARES). TODO(compliance): confirm
// these thresholds against the current FCA appropriateness specification.
export const UK_REFER_THRESHOLD_WITH_SHARES = 0
export const UK_REFER_THRESHOLD_WITHOUT_SHARES = 1
export const UK_CONTACT_US_LINK = 'https://www.thinkmarkets.com/en/support/contact-us/' // TODO confirm exact UK support URL with compliance
