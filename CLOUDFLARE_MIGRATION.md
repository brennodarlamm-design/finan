# FinObra — Cloudflare Pages migration

## Safe first deployment

Create the Cloudflare Pages project from the GitHub repository `brennodarlamm-design/finan` using these settings:

- Framework preset: None
- Production branch (initial test): `cloudflare-pages-migration-20260912`
- Root directory: `/`
- Build command: `npm run build:cloudflare`
- Build output directory: `dist`
- Node version: 22

Do not attach the production custom domain yet. First validate the generated `*.pages.dev` deployment.

## Runtime variables

The Pages Function has safe defaults, but these variables may be set explicitly in both Production and Preview:

- `FINOBRA_API_ORIGIN=https://finan-as.vercel.app`
- `FINOBRA_CANONICAL_ORIGIN=https://finobra.app.br`

These are URLs, not secrets.

## Architecture

- Cloudflare Pages serves only the frontend files from `dist`.
- `/api/*` is handled by `functions/api/[[path]].js`.
- The Pages Function validates same-origin browser mutations, then proxies the API request to the existing Vercel API origin.
- HttpOnly session cookies remain same-origin from the browser's perspective.
- Render continues hosting the WhatsApp/Baileys backend.
- Neon remains the PostgreSQL database.

## Security

The Cloudflare build intentionally excludes:

- `api/`
- `backend/`
- `bin/`
- `migrations/`
- `monitor-nfe/`
- `node_modules/`
- `.git/`
- `.vercel/`

Static responses inherit the CSP and security headers in `cloudflare/_headers`.

Pages Functions are limited to `/api/*` using `cloudflare/_routes.json`, keeping static asset requests outside Workers/Functions invocation billing.

## Route compatibility

The following Vercel routes are mirrored with Pages rewrites:

- `/login`
- `/privacidade`
- `/termos`
- `/apresentacao`
- `/comercial`
- `/landing`
- `/validar` and `/validar/*`
- `/app` and `/app/*`

## Cutover

After `*.pages.dev` is validated:

1. Test login/logout.
2. Test Clientes > Nova Obra and other buttons affected by Patch 26.
3. Test save/update operations that use the HttpOnly session cookie.
4. Test OCR/upload, NFe helpers and WhatsApp actions.
5. Only then attach `finobra.app.br` / `www.finobra.app.br` to Cloudflare Pages.
6. Change the Pages production branch to `main` after the migration branch is merged.
7. Keep the Vercel project online because it continues serving `/api/*`.

## Credentials

Never commit a Cloudflare API token to this repository. Prefer Cloudflare's OAuth-based MCP integration for agents, or store automation tokens only in the platform/CI secret store.
