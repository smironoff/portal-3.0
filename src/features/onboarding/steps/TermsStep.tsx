import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormControlLabel, Checkbox } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  accept: z.literal(true, { error: () => ({ message: 'You must accept the terms' }) }),
})
type Values = z.infer<typeof schema>

export const TermsStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const patch = useOnboardingStore((s) => s.patch)
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
  })
  const submit = handleSubmit(() => {
    patch({ secondaryConsentAccepted: 'true' })
    onNext()
  })
  return (
    <StepLayout title="Terms and conditions" onSubmit={submit} canGoBack={canGoBack} onBack={onBack} submitLabel="Submit">
      <Controller
        name="accept"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Checkbox
                name={field.name}
                ref={field.ref}
                checked={field.value === true}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            }
            label="I accept the terms and conditions"
          />
        )}
      />
      {errors.accept && <span>{errors.accept.message}</span>}
    </StepLayout>
  )
}
