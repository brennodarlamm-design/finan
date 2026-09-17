---
name: dependency-supply-chain-audit
description: Audit application dependencies, lockfiles, package scripts, registries, CI provenance, and build inputs for exploitable supply-chain risk. Use for npm or multi-ecosystem dependency review; do not upgrade packages or alter lockfiles unless remediation is requested.
---

# Dependency and Supply-Chain Audit

Prioritize reachable risk over raw advisory counts.

## Inventory

Identify package managers, workspaces, manifests, lockfiles, runtime versus development dependencies, private registries, install scripts, build plugins, Git dependencies, container bases, and generated artifacts. Flag missing, conflicting, or ignored lockfiles.

## Review

- Run the package manager's non-mutating audit command when network and scope permit.
- Check vulnerable versions, exploit preconditions, affected functionality, reachability, and deployment exposure.
- Inspect direct and transitive packages with lifecycle scripts or unusual install-time behavior.
- Review typosquatting risk, unpinned Git references, broad version ranges, registry overrides, and dependency confusion.
- Check lockfile integrity, reproducible installs, least-privileged CI tokens, protected release workflows, and artifact provenance.
- Review stale or unmaintained critical packages and abandoned forks separately from confirmed vulnerabilities.
- Check whether dev-only tooling is copied into production images or can execute in CI with secrets.

Do not run arbitrary package install scripts from an untrusted repository merely to audit it. Use lockfile inspection and disabled-script installation in an isolated environment if deeper analysis is authorized.

## Remediation

Prefer the smallest compatible version that fixes the issue. Avoid blind major upgrades. Explain breaking-change risk, lockfile impact, and whether a mitigation exists when an upgrade is not immediately possible. Never use forced audit fixes without reviewing the diff and tests.

## Output

Group results into exploitable/likely reachable, potentially reachable, build-only, and unconfirmed. For each item include package path, affected version, runtime context, evidence, impact, fix target, and verification. Note the advisory database/tool and scan date because vulnerability data changes over time.
