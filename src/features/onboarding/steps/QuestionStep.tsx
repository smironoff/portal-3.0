import { useState } from 'react'
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'
import type { Question } from '../api/types'

export const makeQuestionStep =
  (label: string, useQuestionsList: () => Question[]) =>
  ({ onNext, onBack, canGoBack }: StepComponentProps) => {
    const questions = useQuestionsList()
    const question = questions.find((q) => q.label === label)
    const setAnswer = useOnboardingStore((s) => s.setAnswer)
    const existing = useOnboardingStore(
      (s) => s.draft.accountApplicationQuestionDetails?.find((a) => a.question === question?.id)?.answer,
    )
    const [selected, setSelected] = useState<number | undefined>(existing)
    const [error, setError] = useState(false)

    const submit = () => {
      if (selected == null || !question) {
        setError(true)
        return
      }
      setAnswer(question.id, selected)
      onNext()
    }

    if (!question) return <Typography>Loading question...</Typography>

    return (
      <StepLayout title="A quick question" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
        <FormControl error={error}>
          <FormLabel>{question.question}</FormLabel>
          <RadioGroup
            value={selected ?? ''}
            onChange={(e) => {
              setSelected(Number(e.target.value))
              setError(false)
            }}
          >
            {question.answers.map((a) => (
              <FormControlLabel key={a.id} value={a.id} control={<Radio />} label={a.answer} />
            ))}
          </RadioGroup>
        </FormControl>
      </StepLayout>
    )
  }
