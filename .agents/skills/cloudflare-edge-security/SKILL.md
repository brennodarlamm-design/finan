---
name: cloudflare-edge-security
description: Review Cloudflare DNS, proxying, TLS, WAF, rate limits, Workers, Access, cache, origin protection, and API tokens. Use for Cloudflare-fronted applications; verify current settings and features from official documentation before recommending exact rules.
---

# Cloudflare Edge Security

Protect the edge without assuming it fixes origin or application authorization.

## Map the boundary

Inventory proxied and DNS-only records, origins, certificates, TLS modes, Workers/routes, redirects, WAF/rate rules, Access policies, cache rules, tunnels, load balancers, API tokens, and exposed subdomains. Identify any direct origin hostname or IP path.

## Review controls

- Use valid end-to-end TLS and authenticated origin connections where supported; avoid configurations that terminate security at the edge only.
- Restrict origin ingress to trusted paths when practical and prevent bypass through alternate hostnames, IPs, or stale DNS.
- Scope API tokens to the minimum zones, accounts, and permissions; never place global credentials in code.
- Ensure Workers validate inputs, secrets, upstream destinations, authentication, and tenant context.
- Configure WAF rules as defense in depth and document exclusions; do not rely on WAF in place of code fixes.
- Apply rate limits to abuse-sensitive operations using stable identities and protect against bypass through alternate routes.
- Prevent caching of authenticated/personalized responses and avoid cache keys that mix tenants or users.
- Review redirects, Transform Rules, and origin host headers for open redirect, host-header, and SSRF behavior.
- Use Access policies for administrative/internal surfaces and verify service-token handling.
- Review DNSSEC, stale records, unclaimed SaaS targets, email DNS, and certificate issuance controls where relevant.

## Safety and output

Default to read-only inspection. Do not change DNS, WAF, Access, TLS, cache, or origin settings during an audit unless requested. Platform behavior changes; use official Cloudflare documentation for exact current semantics.

Report edge, origin, and application-layer gaps separately. For each finding include affected zone/route, evidence, bypass path, impact, remediation, rollout risk, and a safe test plan.
