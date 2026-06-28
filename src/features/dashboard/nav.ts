import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined'

export interface NavItem {
  key: string
  path: string
  label: string
  icon: ComponentType<SvgIconProps>
}

// The "Core five" dashboard sections. Each currently routes to a placeholder
// screen; later slices replace the placeholders with real features.
export const NAV_ITEMS: NavItem[] = [
  { key: 'accounts', path: '/dashboard', label: 'Accounts', icon: AccountBalanceWalletOutlinedIcon },
  { key: 'funds', path: '/dashboard/funds', label: 'Funds', icon: PaymentsOutlinedIcon },
  { key: 'downloads', path: '/dashboard/downloads', label: 'Downloads', icon: DownloadOutlinedIcon },
  { key: 'tools', path: '/dashboard/tools', label: 'Tools', icon: BuildOutlinedIcon },
  { key: 'support', path: '/dashboard/support', label: 'Support', icon: SupportAgentOutlinedIcon },
]
