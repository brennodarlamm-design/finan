---
name: secure-code-review
description: Review application source code for exploitable security defects and unsafe implementation patterns, with emphasis on TypeScript, Node.js, and React. Use for repository or pull-request security review; do not use as a substitute for deployment, dependency, or live pentest assessment.
---

# Secure Code Review

Find reachable defects and explain them with code evidence.

## Review method

1. Determine runtime, framework, entry points, trust boundaries, authentication middleware, persistence layer, and privileged operations.
2. Search for attacker-controlled sources: request data, headers, cookies, URL parameters, uploaded files, webhooks, message queues, and imported data.
3. Trace sources through validation and authorization to dangerous sinks.
4. Review security controls at the server boundary; client-side checks never satisfy authorization.
5. Validate each candidate in context before reporting it.

## High-value checks

- Broken object- or function-level authorization and missing tenant predicates.
- SQL/NoSQL/command/template injection and unsafe dynamic evaluation.
- Path traversal, unrestricted upload, archive extraction, and server-side request forgery.
- XSS, unsafe HTML rendering, open redirects, and untrusted URL navigation.
- CSRF where cookie-authenticated state-changing routes are exposed.
- Weak randomness, insecure hashing, incorrect encryption, and hard-coded keys.
- Sensitive data in logs, errors, analytics, URLs, client bundles, or source maps.
- Race conditions, replay, duplicate processing, and non-atomic balance or permission changes.
- Mass assignment and over-posting into models.
- Fail-open error handling, debug endpoints, test backdoors, and environment bypasses.

For React, inspect `dangerouslySetInnerHTML`, URL construction, token storage, postMessage handlers, redirects, and assumptions enforced only in UI state. For Node.js, inspect child processes, filesystem operations, fetch destinations, parsers, deserialization, template engines, proxy trust, and middleware order.

## Evidence standard

A finding needs a plausible attacker-controlled source, reachable path, missing or bypassable control, dangerous operation, and concrete impact. Cite file paths and lines. Mark uncertain reachability as a hypothesis, not a vulnerability.

## Remediation

Prefer central controls, allowlists, parameterized queries, explicit field mapping, server-side ownership checks, least privilege, and secure framework primitives. Avoid broad rewrites unless required. If changes are requested, add a regression test that fails before the fix and passes after it.

## Output

Return a short executive summary, confirmed findings ordered by risk, positive controls worth preserving, and coverage gaps. Each finding includes severity, confidence, preconditions, evidence, impact, fix, and verification. Never include usable secrets or unnecessarily weaponized exploit code.
