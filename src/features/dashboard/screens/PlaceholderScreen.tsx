import { Stack, Typography } from '@mui/material'

export const PlaceholderScreen = ({ title }: { title: string }) => (
  <Stack spacing={1}>
    <Typography variant="h5">{title}</Typography>
    <Typography color="text.secondary">This section is coming soon.</Typography>
  </Stack>
)
