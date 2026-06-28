# Dashboard Shell (Slice A) Design

**Date:** 2026-06-28
**Status:** Approved for planning
**Vertical:** Dashboard / post-approval (slice 1 of N)

## Overview

The post-approval experience does not exist yet: an `APPROVED` application renders a one-line stub ("Your account is approved."). This slice builds the persistent authenticated **shell** that all future dashboard features render inside, with placeholder content only. It proves out layout, navigation, theming, responsive behaviour, and logout, without any business data.

This is the first slice of the dashboard vertical. Later slices fill the placeholders: Accounts (real list), Funds (deposit/withdraw/transfer/history/bank accounts), Downloads, Tools, Support, and conditional items (ThinkCopy, PAMM, IB, loyalty, etc.).

## Goal

A `/dashboard/*` route group wrapped in a header + sidebar shell. `APPROVED` users land on `/dashboard`. Each nav item routes to a placeholder screen. Theme toggle and responsive sidebar work. Logout signs the user out.

## Non-goals (explicitly deferred)

- Any real account/funds/tools data or actions.
- Conditional nav (org/account-driven visibility), badges, IB portal.
- User menu / profile display in the header.
- Backend logout call (logout is local-only this slice).
- Onboarding/verify-email gaining chrome — they stay as they are.

## Scope decisions (from brainstorming)

- **Shell wraps `/dashboard/*` only.** Onboarding and verify-email remain chrome-light, matching the legacy separation of Onboarding vs Dashboard areas.
- **Sidebar nav = "Core five":** Accounts, Funds, Downloads, Tools, Support. Plus a Logout item at the bottom.
- **Header:** brand logo (theme-aware) + theme toggle + hamburger (mobile only). No user menu.
- **Logout lives in the sidebar** (legacy convention), not the header.
- **Reach:** the `APPROVED` branch of `OnboardingScreen` redirects to `/dashboard`. Incomplete/pending applications still flow through onboarding.

## Architecture

### Routing

A new `DashboardLayoutRoute` (path `/dashboard`) under `AuthenticatedRoute`, component = `DashboardShell`. Children:

| Path | Screen |
|------|--------|
| `/dashboard` (index) | Accounts placeholder |
| `/dashboard/funds` | Funds placeholder |
| `/dashboard/downloads` | Downloads placeholder |
| `/dashboard/tools` | Tools placeholder |
| `/dashboard/support` | Support placeholder |

Registered in `src/router/router.tsx`:
`AuthenticatedRoute.addChildren([OnboardingRoute, VerifyEmailRoute, DashboardLayoutRoute.addChildren([...])])`.

`AuthenticatedRoute` already guards for a logged-in session, so no extra guard is needed.

### Feature folder: `src/features/dashboard/`

```
src/features/dashboard/
  DashboardShell.tsx              layout: AppBar + sidebar + <Outlet/>
  components/
    DashboardHeader.tsx           logo + ThemeToggle + hamburger
    DashboardSidebar.tsx          Core-five nav + Logout; permanent/drawer
    ThemeToggle.tsx               reads/writes uiStore.themeMode
  screens/
    PlaceholderScreen.tsx         generic "<title> — coming soon"
  nav.ts                          nav item definitions (single source)
  useLogout.ts                    clear tokens + reset session -> redirect
  routes/dashboard.tsx            DashboardLayoutRoute + child routes
```

### Components

**`DashboardShell`** — MUI `Box` layout. Renders `DashboardHeader` (top `AppBar`), `DashboardSidebar`, and a main region containing `<Outlet/>`. Owns the responsive layout: on desktop (≥ `md`) the sidebar is a permanent drawer and the content is offset by its width; below `md` the sidebar is a temporary drawer overlaying content, opened via the header hamburger.

**`DashboardHeader`** — `AppBar` containing:
- The ThinkMarkets logo, variant selected by `uiStore.themeMode` (see Assets below).
- `ThemeToggle`.
- A hamburger `IconButton` shown only below `md`, calling `uiStore.toggleSidebar`.

**`DashboardSidebar`** — renders the nav items from `nav.ts` as a `List`, highlighting the active route (TanStack Router `useMatchRoute`/active state). A Logout `ListItemButton` sits at the bottom, calling `useLogout`. Permanent `Drawer` ≥ `md`; temporary `Drawer` below `md` bound to `uiStore.sidebarOpen` / `toggleSidebar` (closes on nav-item click on mobile).

**`ThemeToggle`** — an `IconButton` toggling `uiStore.themeMode` between `light` and `dark` via `setThemeMode`. The existing `ThemeProvider` already re-themes the app from `themeMode`.

**`PlaceholderScreen`** — a presentational component taking a `title` (and optional description); renders a heading + "This section is coming soon." Each route renders it with its section title (sourced from the nav definition / i18n).

**`nav.ts`** — exports an array of `{ key, path, labelKey, icon }` for the Core five. Single source consumed by the sidebar and (optionally) by the route definitions for titles.

**`useLogout`** — a hook returning a `logout` callback that:
1. Calls `tokenStore.clear()` (removes all auth keys).
2. Calls `useSessionStore.getState().reset()` (`loggedIn = false`).
3. Navigates to `/account/login`.

It is **fail-safe**: steps 2–3 run even if step 1 throws (wrapped so a storage error can never leave the user stuck logged-in). No backend logout call this slice.

### State / data

No data fetching. Reuses existing `uiStore`: `themeMode` / `setThemeMode` (theme), `sidebarOpen` / `toggleSidebar` (responsive drawer). No new store.

### Landing wiring

`OnboardingScreen`'s `status === 'APPROVED'` branch changes from rendering stub text to redirecting to `/dashboard` (via TanStack Router `redirect`/`Navigate`). Application status is known there; the `resolveLandingRoute(profile)` seam does not see application status, so the redirect lives in `OnboardingScreen` rather than the landing resolver. `resolveLandingRoute` is unchanged (still `/onboarding`); login lands users on onboarding, which forwards approved users on to the dashboard.

### Assets

Two brand logos copied from legacy into `src/assets/` (git-tracked):
- `tm-portal-light.png` — black "Think" + green "Markets®". **Use in LIGHT theme.**
- `tm-portal-dark.png` — white "Think" + green "Markets®". **Use in DARK theme.**

The naming is by *target background*, not logo colour. The header picks the variant matching `themeMode`: `light` → `tm-portal-light.png`, `dark` → `tm-portal-dark.png`. Wiring them backwards makes the logo text invisible against the background — this is the one easy mistake to avoid.

### i18n

New `dashboard.*` keys in the `common` locale for nav labels and placeholder titles (real strings, no placeholders): e.g. `dashboard.nav.accounts`, `dashboard.nav.funds`, `dashboard.nav.downloads`, `dashboard.nav.tools`, `dashboard.nav.support`, `dashboard.nav.logout`, `dashboard.placeholder.comingSoon`.

## Error handling

The shell is static, so there is little to fail. The one path: `useLogout` must always end with the user logged out locally and on the login screen, even if clearing storage throws.

## Testing

**Unit (Vitest + Testing Library):**
- `DashboardSidebar`: renders the Core five + Logout; marks the active route; clicking Logout invokes the logout callback; mobile drawer closes on nav click.
- `DashboardHeader`: theme toggle flips `uiStore.themeMode`; correct logo variant per mode; hamburger toggles `uiStore.sidebarOpen`; hamburger hidden ≥ `md`.
- `useLogout`: clears `tokenStore`, resets `sessionStore`, navigates to `/account/login`; still navigates + resets when `tokenStore.clear` throws.
- `OnboardingScreen`: `APPROVED` redirects to `/dashboard` (update the existing approved-branch assertion).

**e2e (Playwright):**
- Log in with a mocked `getLastApplicationsInfo` → `APPROVED`; assert landing on `/dashboard` showing the Accounts placeholder and the nav.
- Click Funds → funds placeholder renders.
- Click Logout → back on the login screen; protected routes redirect to login.

## Definition of done

- `/dashboard` shell renders with header (theme-aware logo, theme toggle, mobile hamburger) and sidebar (Core five + Logout).
- All five nav items route to placeholder screens; Accounts is the index.
- Theme toggle re-themes the app and swaps the logo variant.
- Sidebar is permanent on desktop, a toggleable drawer on mobile.
- Logout clears the session and returns to login.
- `APPROVED` applications land on `/dashboard`.
- All suites green (lint, tsc, vitest, playwright).
