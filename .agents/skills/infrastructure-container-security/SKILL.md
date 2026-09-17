---
name: infrastructure-container-security
description: Review Dockerfiles, container images, Compose or orchestration files, CI build context, operating-system hardening, and infrastructure configuration. Use for container and IaC security; do not deploy or mutate live infrastructure unless explicitly requested.
---

# Infrastructure and Container Security

Assess build provenance, runtime privilege, exposure, and secret boundaries.

## Review build inputs

- Pin trusted base images by stable version or digest according to the project's update policy.
- Use minimal runtime stages and exclude compilers, package managers, tests, credentials, and caches from final images.
- Inspect `.dockerignore` and build context for `.git`, `.env`, keys, backups, and large sensitive files.
- Avoid remote scripts piped directly to a shell and verify downloaded artifacts.
- Treat build arguments and image layers as non-secret; use supported secret mounts for sensitive build inputs.
- Generate or inspect an SBOM when available and scan the final runtime image, not only manifests.

## Review runtime

- Run as a non-root user and drop unnecessary Linux capabilities.
- Avoid privileged mode, host networking/PID, Docker socket mounts, broad device access, and writable host paths.
- Prefer read-only filesystems and controlled writable paths where compatible.
- Set resource limits, health checks, restart behavior, and safe signal handling.
- Expose only required ports; bind administrative interfaces to private networks.
- Mount secrets at runtime with narrow permissions and prevent them from entering logs or crash dumps.
- Separate services and networks; do not place every component on one flat trusted network.

## IaC and host checks

Review public ingress, IAM, storage exposure, encryption/key ownership, backup access, metadata endpoints, logging, patching, and drift. Do not apply Terraform, Compose, Kubernetes, or cloud changes during a review.

## Output

Report source file and line, build or runtime stage, exploitable condition, impact, remediation, and compatibility considerations. Separate confirmed misconfigurations from hardening opportunities and note what requires live-environment verification.
