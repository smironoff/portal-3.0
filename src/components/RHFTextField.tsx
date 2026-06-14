import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'
import { useController, useFormContext } from 'react-hook-form'

type Props = Omit<TextFieldProps, 'name'> & { name: string }

export const RHFTextField = ({ name, ...rest }: Props) => {
  const { control } = useFormContext()
  const { field, fieldState } = useController({ name, control })
  return (
    <TextField
      {...rest}
      {...field}
      error={!!fieldState.error}
      helperText={fieldState.error?.message ?? rest.helperText}
    />
  )
}
