---
name: threat-modeling
description: Build a practical threat model for a feature, SaaS, API, integration, or architecture using assets, actors, trust boundaries, abuse cases, and prioritized mitigations. Use before design changes or to guide a security review; do not claim implementation defects without code or runtime evidence.
---

# Threat Modeling

Produce a decision tool, not a generic checklist.

## Establish scope

Capture the feature or system, deployment environments, data sensitivity, tenants, roles, integrations, assumptions, and exclusions. If a missing fact materially changes the design, ask one focused question; otherwise state the assumption.

## Model the system

1. List valuable assets: accounts, tenant data, financial records, documents, secrets, admin privileges, availability, and audit integrity.
2. Identify actors: anonymous user, ordinary member, tenant admin, platform admin, support agent, service, compromised dependency, and malicious insider.
3. Describe components, data flows, entry points, and trust boundaries.
4. Generate concrete abuse cases using STRIDE or an equivalent lens, but write them as attacker goals and paths.
5. Map existing controls, gaps, detection opportunities, and recovery measures.
6. Prioritize by impact, likelihood, exposure, and control strength.

## SaaS abuse cases

Always consider cross-tenant reads/writes, privilege escalation, invitation takeover, support impersonation, bulk export, webhook forgery/replay, malicious upload, SSRF into internal services, secret theft, dependency compromise, cache mixing, data deletion, billing abuse, and audit-log tampering.

## Mitigation quality

Prefer preventive controls at trust boundaries: server-side authorization, tenant-aware queries/RLS, explicit schemas, least privilege, isolation, signed and replay-resistant messages, rate limits, secure defaults, and independent audit trails. Pair high-impact threats with detection and recovery, not prevention alone.

## Output

Provide scope/assumptions, a compact component-and-flow description, a prioritized threat table, recommended controls, validation ideas, and residual risks. Each threat includes asset, actor, preconditions, attack path, impact, existing controls, priority, and owner/action. Clearly distinguish design risks from verified vulnerabilities.
