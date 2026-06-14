import { Button as MuiButton } from '@mui/material'
import type { ButtonProps } from '@mui/material'

export function Button(props: ButtonProps) {
  return <MuiButton variant="contained" disableElevation {...props} />
}
