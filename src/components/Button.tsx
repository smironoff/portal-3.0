import { Button as MuiButton } from '@mui/material'
import type { ButtonProps } from '@mui/material'

export const Button = (props: ButtonProps) => {
  return <MuiButton variant="contained" disableElevation {...props} />
}
