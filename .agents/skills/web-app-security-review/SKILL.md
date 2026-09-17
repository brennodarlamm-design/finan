---
name: web-app-security-review
description: Review browser-facing web applications for XSS, CSRF, clickjacking, navigation, storage, upload, cookie, and security-header risks. Use for React or other web UI security review; do not use for API authorization or infrastructure assessment alone.
---

# Web Application Security Review

Assess browser attack surface while treating server authorization as the security boundary.

## Inspect the application

- Identify rendered content sources, client/server rendering boundaries, authentication storage, forms, uploads, redirects, cross-window messaging, third-party scripts, and service workers.
- Trace untrusted values into HTML, attributes, styles, URLs, script contexts, DOM APIs, and downloadable files.
- Determine whether state-changing requests use cookies, bearer tokens, or both.

## Review controls

- XSS: contextual encoding, sanitization, template behavior, Markdown renderers, SVG, `dangerouslySetInnerHTML`, DOM sinks, and CSP.
- CSRF: SameSite cookie policy, anti-CSRF tokens, Origin/Referer validation, and unsafe GET actions.
- Sessions: Secure/HttpOnly/SameSite attributes, rotation, logout invalidation, and avoidance of long-lived tokens in `localStorage`.
- Navigation: allowlisted redirects, safe external links, `noopener`, and avoidance of `javascript:` or attacker-controlled schemes.
- Framing: `frame-ancestors` or equivalent protection where embedding is not required.
- Cross-origin behavior: narrow CORS, postMessage origin/source validation, and controlled credential use.
- Files: extension, MIME, magic-byte, size, storage location, download disposition, and active-content handling.
- Headers: CSP, HSTS where appropriate, content type, referrer policy, permissions policy, and cache controls for sensitive pages.
- Build output: source maps, debug data, public environment variables, and secrets embedded in bundles.

Do not report missing headers without considering hosting and CDN configuration. Do not treat UI-hidden buttons or routes as access controls.

## Verification and output

Use source evidence first. Browser testing must stay within authorized scope and avoid real user data. Report confirmed findings with context, browser behavior, impact, remediation, and a regression test. Include defense-in-depth improvements separately and state which headers or CDN settings could not be observed.
