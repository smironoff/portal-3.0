# Dashboard Shell (Slice A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the persistent authenticated dashboard shell (header + responsive sidebar) wrapping a new `/dashboard/*` route group with placeholder content screens, and route APPROVED applications to it.

**Architecture:** A new `src/features/dashboard/` feature folder. A `DashboardShell` layout (MUI `AppBar` + `Drawer` + `Outlet`) registered as `DashboardLayoutRoute` under the existing `AuthenticatedRoute`, with five child routes rendering a shared `PlaceholderScreen`. Theme and responsive drawer state reuse the existing `uiStore`. Logout is a local-only hook. The APPROVED branch of `OnboardingScreen` redirects to `/dashboard`.

**Tech Stack:** React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), TanStack Router, Zustand, MUI v9 + `@mui/icons-material` (added in Task 1), Vitest + Testing Library, Playwright.

**Reference:** `docs/superpowers/specs/2026-06-28-dashboard-shell-design.md`.

## Global Constraints

- **Node 20.** Run npm/npx via the project's pinned Node.
- **Arrow functions only** (no `function` declarations) — matches the codebase style.
- **Hardcoded British English copy** in components. No component consumes `react-i18next` yet; do not introduce it here. (Deviation from the spec's i18n-keys line — i18n adoption is deferred until the codebase adopts `useTranslation` broadly.)
- **Formal, professional copy. No emojis.** No em or en dashes in any copy.
- **`git add <specific files>` only** — never `git add -A`/`.`.
- One commit per task. Verify lint + tsc + the task's tests before each commit.
- Verification gate per task: `npm run lint && npx tsc -p tsconfig.json --noEmit` clean, plus the task's vitest/playwright run green.

---

### Task 1: Add `@mui/icons-material` + nav definitions

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/features/dashboard/nav.ts`

**Interfaces:**
- Produces: `NavItem` interface `{ key: string; path: string; label: string; icon: ComponentType<SvgIconProps> }` and `NAV_ITEMS: NavItem[]` (the Core five). Consumed by the sidebar (Task 5) and routes (Task 7).

- [ ] **Step 1: Install the icon package** (version aligned to MUI v9):

```bash
npm install @mui/icons-material@^9.1.1
```

- [ ] **Step 2: Verify it resolves** — `npx tsc -p tsconfig.json --noEmit` (clean; no other changes yet).

- [ ] **Step 3: Create `src/features/dashboard/nav.ts`:**

```ts
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
```

- [ ] **Step 4: Verify** — `npx tsc -p tsconfig.json --noEmit && npm run lint` (clean).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/features/dashboard/nav.ts
git commit -m "feat(dashboard): add mui icons + Core-five nav definitions"
```

---

### Task 2: `useLogout` hook

**Files:**
- Create: `src/features/dashboard/useLogout.ts`
- Test: `src/features/dashboard/useLogout.test.ts`

**Interfaces:**
- Consumes: `tokenStore.clear()` from `@/api/tokenStore`; `useSessionStore` from `@/state/sessionStore` (`reset()`, `setLoggedIn`); `useNavigate` from `@tanstack/react-router`.
- Produces: `useLogout(): () => void` — calling the returned function logs the user out and navigates to `/account/login`. Consumed by the sidebar (Task 5).

- [ ] **Step 1: Write the failing test** `src/features/dashboard/useLogout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const navigate = vi.fn()
const clear = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/api/tokenStore', () => ({ tokenStore: { clear } }))

beforeEach(() => {
  navigate.mockReset()
  clear.mockReset()
})

describe('useLogout', () => {
  it('clears tokens, resets the session, and navigates to login', async () => {
    const { useLogout } = await import('./useLogout')
    const { useSessionStore } = await import('@/state/sessionStore')
    useSessionStore.getState().setLoggedIn(true)
    const { result } = renderHook(() => useLogout())
    result.current()
    expect(clear).toHaveBeenCalled()
    expect(useSessionStore.getState().loggedIn).toBe(false)
    expect(navigate).toHaveBeenCalledWith({ to: '/account/login', search: { error: undefined } })
  })

  it('still resets and navigates when clearing tokens throws', async () => {
    clear.mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const { useLogout } = await import('./useLogout')
    const { useSessionStore } = await import('@/state/sessionStore')
    useSessionStore.getState().setLoggedIn(true)
    const { result } = renderHook(() => useLogout())
    result.current()
    expect(useSessionStore.getState().loggedIn).toBe(false)
    expect(navigate).toHaveBeenCalledWith({ to: '/account/login', search: { error: undefined } })
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/features/dashboard/useLogout.test.ts` (cannot resolve `./useLogout`).

- [ ] **Step 3: Implement** `src/features/dashboard/useLogout.ts`:

```ts
import { useNavigate } from '@tanstack/react-router'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'

// Local-only logout: clears stored tokens, drops the session flag, and returns
// to login. Fail-safe — the session is always cleared and the user redirected
// even if clearing storage throws, so a user can never be left stuck signed in.
// (Backend session invalidation is deferred to a later slice.)
export const useLogout = (): (() => void) => {
  const navigate = useNavigate()
  return () => {
    try {
      tokenStore.clear()
    } finally {
      useSessionStore.getState().reset()
      navigate({ to: '/account/login', search: { error: undefined } })
    }
  }
}
```

- [ ] **Step 4: Run it, verify PASS** — `npx vitest run src/features/dashboard/useLogout.test.ts`.

- [ ] **Step 5: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/dashboard/useLogout.ts src/features/dashboard/useLogout.test.ts
git commit -m "feat(dashboard): local-only useLogout hook (fail-safe)"
```

---

### Task 3: `ThemeToggle`

**Files:**
- Create: `src/features/dashboard/components/ThemeToggle.tsx`
- Test: `src/features/dashboard/components/ThemeToggle.test.tsx`

**Interfaces:**
- Consumes: `useUIStore` (`themeMode`, `setThemeMode`).
- Produces: `<ThemeToggle />` — an `IconButton` (accessible name "Toggle theme") flipping `themeMode`. Consumed by the header (Task 4).

- [ ] **Step 1: Write the failing test** `ThemeToggle.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'
import { useUIStore } from '@/state/uiStore'

beforeEach(() => useUIStore.getState().setThemeMode('light'))

describe('ThemeToggle', () => {
  it('toggles theme mode from light to dark', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(useUIStore.getState().themeMode).toBe('dark')
  })

  it('toggles back from dark to light', async () => {
    useUIStore.getState().setThemeMode('dark')
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }))
    expect(useUIStore.getState().themeMode).toBe('light')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `ThemeToggle.tsx`:

```tsx
import { IconButton } from '@mui/material'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useUIStore } from '@/state/uiStore'

export const ThemeToggle = () => {
  const themeMode = useUIStore((s) => s.themeMode)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  return (
    <IconButton
      aria-label="Toggle theme"
      color="inherit"
      onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
    >
      {themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
    </IconButton>
  )
}
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/dashboard/components/ThemeToggle.tsx src/features/dashboard/components/ThemeToggle.test.tsx
git commit -m "feat(dashboard): theme toggle control"
```

---

### Task 4: `DashboardHeader`

**Files:**
- Create: `src/features/dashboard/components/DashboardHeader.tsx`
- Test: `src/features/dashboard/components/DashboardHeader.test.tsx`
- Add (already copied, currently untracked): `src/assets/tm-portal-light.png`, `src/assets/tm-portal-dark.png`

**Interfaces:**
- Consumes: `useUIStore` (`themeMode`, `toggleSidebar`), `ThemeToggle`, the two logo assets.
- Produces: `<DashboardHeader />` — fixed `AppBar` with a theme-aware logo, the hamburger (accessible name "Open navigation"), and `ThemeToggle`. Consumed by the shell (Task 6).

- [ ] **Step 1: Write the failing test** `DashboardHeader.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardHeader } from './DashboardHeader'
import { useUIStore } from '@/state/uiStore'

beforeEach(() => {
  useUIStore.getState().setThemeMode('light')
  useUIStore.setState({ sidebarOpen: false })
})

describe('DashboardHeader', () => {
  it('the hamburger toggles the sidebar', async () => {
    render(<DashboardHeader />)
    await userEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it('shows a different logo variant in dark mode', () => {
    useUIStore.getState().setThemeMode('light')
    render(<DashboardHeader />)
    const lightSrc = (screen.getByAltText('ThinkMarkets') as HTMLImageElement).src
    cleanup()
    useUIStore.getState().setThemeMode('dark')
    render(<DashboardHeader />)
    const darkSrc = (screen.getByAltText('ThinkMarkets') as HTMLImageElement).src
    expect(darkSrc).not.toBe(lightSrc)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `DashboardHeader.tsx`. `AppBar` uses `color="default"` so its background follows the theme paper colour, which makes the theme-keyed logo choice correct (light theme = light background = the black-text `light` logo; dark theme = dark background = the white-text `dark` logo). The drawer width constant is shared with the shell/sidebar.

```tsx
import { AppBar, Box, IconButton, Toolbar } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useUIStore } from '@/state/uiStore'
import { ThemeToggle } from './ThemeToggle'
import logoLight from '@/assets/tm-portal-light.png'
import logoDark from '@/assets/tm-portal-dark.png'

export const DRAWER_WIDTH = 240

export const DashboardHeader = () => {
  const themeMode = useUIStore((s) => s.themeMode)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  // Logo filenames are named by TARGET BACKGROUND, not ink colour:
  // light theme -> light background -> tm-portal-light.png (black "Think").
  const logo = themeMode === 'dark' ? logoDark : logoLight
  return (
    <AppBar position="fixed" color="default" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
      <Toolbar sx={{ gap: 1 }}>
        <IconButton
          aria-label="Open navigation"
          edge="start"
          color="inherit"
          onClick={toggleSidebar}
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Box component="img" src={logo} alt="ThinkMarkets" sx={{ height: 28 }} />
        <Box sx={{ flexGrow: 1 }} />
        <ThemeToggle />
      </Toolbar>
    </AppBar>
  )
}
```

- [ ] **Step 4: Run it, verify PASS** — `npx vitest run src/features/dashboard/components/DashboardHeader.test.tsx`.

- [ ] **Step 5: Verify + commit** (the logo assets are committed here, where they are first consumed):

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/dashboard/components/DashboardHeader.tsx src/features/dashboard/components/DashboardHeader.test.tsx src/assets/tm-portal-light.png src/assets/tm-portal-dark.png
git commit -m "feat(dashboard): header with theme-aware logo + mobile hamburger"
```

---

### Task 5: `DashboardSidebar`

**Files:**
- Create: `src/features/dashboard/components/DashboardSidebar.tsx`
- Test: `src/features/dashboard/components/DashboardSidebar.test.tsx`
- Modify: `src/state/uiStore.ts:21` (change `sidebarOpen` default from `true` to `false`)

**Interfaces:**
- Consumes: `NAV_ITEMS` (Task 1), `useLogout` (Task 2), `DRAWER_WIDTH` (Task 4), `useUIStore` (`sidebarOpen`, `toggleSidebar`), `useNavigate` + `useLocation` from `@tanstack/react-router`.
- Produces: `<DashboardSidebar />` — a permanent drawer at `md`+ and a temporary drawer below, both listing the Core five (each a button named by its label) plus a "Log out" button. Consumed by the shell (Task 6).

- [ ] **Step 1: Change the `sidebarOpen` default.** In `src/state/uiStore.ts`, line 21, change `sidebarOpen: true,` to `sidebarOpen: false,`. Rationale: the desktop drawer is permanent and ignores the flag; the flag now solely drives the mobile temporary drawer, which must start closed so it does not cover content on first load. (No existing test asserts this default — there is no `uiStore.test.ts`.)

- [ ] **Step 2: Write the failing test** `DashboardSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.fn()
const logout = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/dashboard' }),
}))
vi.mock('../useLogout', () => ({ useLogout: () => logout }))

beforeEach(() => {
  navigate.mockReset()
  logout.mockReset()
})

describe('DashboardSidebar', () => {
  it('renders the Core five and a logout action', async () => {
    const { DashboardSidebar } = await import('./DashboardSidebar')
    render(<DashboardSidebar />)
    for (const label of ['Accounts', 'Funds', 'Downloads', 'Tools', 'Support']) {
      // permanent + temporary drawers both render the list, so each label appears twice
      expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByRole('button', { name: /log out/i }).length).toBeGreaterThan(0)
  })

  it('navigates when a nav item is clicked', async () => {
    const { DashboardSidebar } = await import('./DashboardSidebar')
    render(<DashboardSidebar />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Funds' })[0]!)
    expect(navigate).toHaveBeenCalledWith({ to: '/dashboard/funds' })
  })

  it('invokes logout when the logout action is clicked', async () => {
    const { DashboardSidebar } = await import('./DashboardSidebar')
    render(<DashboardSidebar />)
    await userEvent.click(screen.getAllByRole('button', { name: /log out/i })[0]!)
    expect(logout).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run it, verify FAIL.**

- [ ] **Step 4: Implement** `DashboardSidebar.tsx`. The nav list is factored into a single inner `NavList` (DRY) rendered by both drawers. Active state from `useLocation().pathname`. On mobile, navigating closes the temporary drawer.

```tsx
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar } from '@mui/material'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { NAV_ITEMS } from '../nav'
import { useLogout } from '../useLogout'
import { useUIStore } from '@/state/uiStore'
import { DRAWER_WIDTH } from './DashboardHeader'

const NavList = ({ onNavigate }: { onNavigate: (path: string) => void }) => {
  const { pathname } = useLocation()
  const logout = useLogout()
  return (
    <>
      <Toolbar />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <List sx={{ flexGrow: 1 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <ListItemButton
                key={item.key}
                selected={pathname === item.path}
                onClick={() => onNavigate(item.path)}
              >
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            )
          })}
        </List>
        <List>
          <ListItemButton onClick={logout}>
            <ListItemIcon>
              <LogoutOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Log out" />
          </ListItemButton>
        </List>
      </Box>
    </>
  )
}

export const DashboardSidebar = () => {
  const navigate = useNavigate()
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const goPermanent = (path: string) => navigate({ to: path })
  const goTemporary = (path: string) => {
    navigate({ to: path })
    toggleSidebar() // close the mobile drawer after navigating
  }

  return (
    <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={toggleSidebar}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <NavList onNavigate={goTemporary} />
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <NavList onNavigate={goPermanent} />
      </Drawer>
    </Box>
  )
}
```

- [ ] **Step 5: Run it, verify PASS.**

- [ ] **Step 6: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/dashboard/components/DashboardSidebar.tsx src/features/dashboard/components/DashboardSidebar.test.tsx src/state/uiStore.ts
git commit -m "feat(dashboard): responsive sidebar nav (Core five + logout)"
```

---

### Task 6: `PlaceholderScreen` + `DashboardShell`

**Files:**
- Create: `src/features/dashboard/screens/PlaceholderScreen.tsx`
- Create: `src/features/dashboard/DashboardShell.tsx`
- Test: `src/features/dashboard/screens/PlaceholderScreen.test.tsx`

**Interfaces:**
- Consumes: `DashboardHeader`, `DashboardSidebar`, `DRAWER_WIDTH`, `Outlet` from `@tanstack/react-router`.
- Produces: `<PlaceholderScreen title="..." />` (heading + "coming soon" body) and `<DashboardShell />` (header + sidebar + main `Outlet`). Both consumed by routes (Task 7).

- [ ] **Step 1: Write the failing test** `PlaceholderScreen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlaceholderScreen } from './PlaceholderScreen'

describe('PlaceholderScreen', () => {
  it('renders the section title as a heading and a coming-soon note', () => {
    render(<PlaceholderScreen title="Funds" />)
    expect(screen.getByRole('heading', { name: 'Funds' })).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `PlaceholderScreen.tsx`:

```tsx
import { Stack, Typography } from '@mui/material'

export const PlaceholderScreen = ({ title }: { title: string }) => (
  <Stack spacing={1}>
    <Typography variant="h5">{title}</Typography>
    <Typography color="text.secondary">This section is coming soon.</Typography>
  </Stack>
)
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Implement** `DashboardShell.tsx` (no separate unit test; covered by the e2e in Task 8). The leading `<Toolbar />` spacer offsets content below the fixed `AppBar`.

```tsx
import { Box, Toolbar } from '@mui/material'
import { Outlet } from '@tanstack/react-router'
import { DashboardHeader, DRAWER_WIDTH } from './components/DashboardHeader'
import { DashboardSidebar } from './components/DashboardSidebar'

export const DashboardShell = () => (
  <Box sx={{ display: 'flex' }}>
    <DashboardHeader />
    <DashboardSidebar />
    <Box
      component="main"
      sx={{ flexGrow: 1, p: 3, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}
    >
      <Toolbar />
      <Outlet />
    </Box>
  </Box>
)
```

- [ ] **Step 6: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint && npx vitest run src/features/dashboard
git add src/features/dashboard/screens/PlaceholderScreen.tsx src/features/dashboard/screens/PlaceholderScreen.test.tsx src/features/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): placeholder screen + shell layout"
```

---

### Task 7: Routes, registration, and APPROVED landing redirect

**Files:**
- Create: `src/features/dashboard/routes/dashboard.tsx`
- Modify: `src/router/router.tsx` (import + register the dashboard routes)
- Modify: `src/features/onboarding/OnboardingScreen.tsx` (APPROVED branch redirects)
- Test: `src/features/onboarding/OnboardingScreen.approved.test.tsx`

**Interfaces:**
- Consumes: `DashboardShell`, `PlaceholderScreen`, `AuthenticatedRoute`.
- Produces: `DashboardLayoutRoute` (+ child routes) exported for registration.

- [ ] **Step 1: Implement** `src/features/dashboard/routes/dashboard.tsx`. The index route renders the Accounts placeholder; the four others render their placeholders.

```tsx
import { createRoute } from '@tanstack/react-router'
import { AuthenticatedRoute } from '@/router/routes/authenticated'
import { DashboardShell } from '@/features/dashboard/DashboardShell'
import { PlaceholderScreen } from '@/features/dashboard/screens/PlaceholderScreen'

export const DashboardLayoutRoute = createRoute({
  getParentRoute: () => AuthenticatedRoute,
  path: '/dashboard',
  component: DashboardShell,
})

const AccountsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: '/',
  component: () => <PlaceholderScreen title="Accounts" />,
})
const FundsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'funds',
  component: () => <PlaceholderScreen title="Funds" />,
})
const DownloadsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'downloads',
  component: () => <PlaceholderScreen title="Downloads" />,
})
const ToolsRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'tools',
  component: () => <PlaceholderScreen title="Tools" />,
})
const SupportRoute = createRoute({
  getParentRoute: () => DashboardLayoutRoute,
  path: 'support',
  component: () => <PlaceholderScreen title="Support" />,
})

export const dashboardRouteTree = DashboardLayoutRoute.addChildren([
  AccountsRoute,
  FundsRoute,
  DownloadsRoute,
  ToolsRoute,
  SupportRoute,
])
```

- [ ] **Step 2: Register in `src/router/router.tsx`.** Add the import and include the tree under `AuthenticatedRoute.addChildren`:

```ts
import { dashboardRouteTree } from '@/features/dashboard/routes/dashboard'
```

Change the authenticated children line to:

```ts
  AuthenticatedRoute.addChildren([OnboardingRoute, VerifyEmailRoute, dashboardRouteTree]),
```

- [ ] **Step 3: Write the failing test** `src/features/onboarding/OnboardingScreen.approved.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const navigate = vi.fn()
vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'APPROVED' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => navigate.mockReset())

describe('OnboardingScreen (approved)', () => {
  it('redirects an approved application to the dashboard', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(navigate).toHaveBeenCalledWith({ to: '/dashboard' })
  })
})
```

- [ ] **Step 4: Run it, verify FAIL** — `npx vitest run src/features/onboarding/OnboardingScreen.approved.test.tsx` (the current APPROVED branch renders text, does not navigate).

- [ ] **Step 5: Implement the redirect** in `src/features/onboarding/OnboardingScreen.tsx`. Add an `ApprovedRedirect` component alongside the existing `Level1Done`/`OnboardingComplete` helpers (the file already imports `useEffect` and `useNavigate`):

```tsx
const ApprovedRedirect = () => {
  const navigate = useNavigate()
  useEffect(() => {
    navigate({ to: '/dashboard' })
  }, [navigate])
  return <Typography>Redirecting to your dashboard...</Typography>
}
```

Then replace the existing APPROVED branch:

```tsx
  if (status === 'APPROVED') {
    return <Typography>Your account is approved.</Typography>
  }
```

with:

```tsx
  if (status === 'APPROVED') {
    return <ApprovedRedirect />
  }
```

- [ ] **Step 6: Run the test, verify PASS**, and run the full onboarding suite to confirm no regression: `npx vitest run src/features/onboarding`.

- [ ] **Step 7: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/dashboard/routes/dashboard.tsx src/router/router.tsx src/features/onboarding/OnboardingScreen.tsx src/features/onboarding/OnboardingScreen.approved.test.tsx
git commit -m "feat(dashboard): /dashboard routes + approved applications land on dashboard"
```

---

### Task 8: Playwright e2e

**Files:**
- Create: `e2e/dashboard.spec.ts`

- [ ] **Step 1: Write the e2e.** Logs in (status `OK` + tokens, no 2FA), mocks the profile and an `APPROVED` application, asserts landing on `/dashboard` with the Accounts placeholder, navigates to Funds, then logs out back to login.

```ts
import { test, expect } from '@playwright/test'

test('approved user lands on the dashboard shell, navigates, and logs out', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({
      json: {
        status: 'OK',
        tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' },
      },
    })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', additionalAttributes: {} })
    if (action === 'getLastApplicationsInfo') return ok([{ applicationId: 1, status: 'APPROVED' }])
    if (action === 'getQuestions') return ok([])
    return ok({})
  })

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  // login -> /onboarding -> OnboardingScreen sees APPROVED -> redirect /dashboard
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()

  await page.getByRole('button', { name: 'Funds' }).click()
  await expect(page.getByRole('heading', { name: 'Funds' })).toBeVisible()

  await page.getByRole('button', { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/account\/login/)
})
```

- [ ] **Step 2: Run it** — `npx playwright test e2e/dashboard.spec.ts --reporter=line` (passes). Debug selectors/mocking as needed; do not weaken assertions. Note: the default Playwright viewport is desktop, so the permanent sidebar (and its visible "Funds" / "Log out" buttons) is shown.

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test(e2e): approved user reaches dashboard shell, navigates, logs out"
```

---

### Task 9: Full verification gate

- [ ] **Step 1: Run the whole suite** — `npm run lint && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx playwright test` (all green).

- [ ] **Step 2:** If any fixes were required, commit them with a clear message. Otherwise, no commit.

- [ ] **Step 3: Confirm the definition of done** against the spec: shell renders with theme-aware logo + theme toggle + mobile hamburger; sidebar shows Core five + logout; all five route to placeholders with Accounts as the index; theme toggle re-themes and swaps the logo; sidebar is permanent on desktop and a toggleable drawer on mobile; logout clears the session and returns to login; APPROVED applications land on `/dashboard`.

---

## Self-review notes

- **Spec coverage:** shell wrapping `/dashboard/*` only (Task 6/7); Core five + logout (Tasks 1/5); header logo + theme toggle + hamburger (Tasks 3/4); permanent/temporary drawers (Task 5); placeholder screens with Accounts index (Tasks 6/7); local fail-safe logout (Task 2); APPROVED redirect (Task 7); reused `uiStore` (Tasks 3/4/5); unit + e2e tests (all tasks + Task 8). All design sections map to a task.
- **i18n deviation:** the spec called for `dashboard.*` i18n keys; the codebase does not yet consume `react-i18next` in any component, so this slice uses hardcoded British English copy to match the established pattern. Recorded in Global Constraints.
- **`sidebarOpen` default change** (true to false) is required for correct mobile behaviour and is safe (no test asserts it); called out in Task 5 Step 1.
- **Logo variant mapping** (by target background) is documented inline in Task 4 to prevent wiring the two PNGs backwards.
- **Type consistency:** `DRAWER_WIDTH` is defined once in `DashboardHeader.tsx` and imported by the sidebar and shell; `NavItem`/`NAV_ITEMS` shapes are consistent across Tasks 1/5/7; `useLogout` signature `() => (() => void)` matches its consumer in Task 5.
