# Local HTTPS dev server

The dev server runs at **`https://portal-test.thinkmarkets.com`** on **port 443**, with a proxy (ported from the legacy `setupProxy.js`) that forwards API paths to the selected backend tier so there is no CORS in development.

## One-time setup

1. **Hosts entry** (already present on the original dev machine):
   ```
   127.0.0.1 portal-test.thinkmarkets.com
   ```
   Add it to `/etc/hosts` if missing.

2. **TLS certificates.** Place `server.crt` and `server.key` in `.certs/` (git-ignored). The certificate must be issued for `portal-test.thinkmarkets.com`. The bundled certs are signed by a local "Test CA"; import `.certs/ca.crt` into your OS/browser trust store so the browser trusts the dev server. Without certs, the dev server falls back to plain HTTP.

## Running

Port 443 is privileged, so the dev server needs elevated permissions. `sudo` resets `PATH`, so preserve the Node 20 toolchain explicitly (the machine default Node is v14, which will not work):

```bash
nvm use                          # selects Node 20.20.0 from .nvmrc
sudo -E env "PATH=$PATH" npm run dev
```

Then open `https://portal-test.thinkmarkets.com`.

## Backend tier

The proxy targets are defined in `vite.config.ts` (`upstreams`). The active tier is the `env` constant (`'uat' | 'staging' | 'hk' | 'ld'`, default `uat`). `.env.development` points all app URLs at the dev origin (`https://portal-test.thinkmarkets.com`) so requests pass through the proxy. Proxied path prefixes: `/cportal`, `/auth`, `/user`, `/internal`, `/realms`, `/authentication`, `/address`, `/exchange-rate`, `/signals`, `/venus`.

## Tests

The Playwright e2e suite does not use port 443: it overrides the Vite host/port to `127.0.0.1:4173` and ignores the self-signed cert, so `npm run e2e` runs without sudo.
