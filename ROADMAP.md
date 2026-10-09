# UACF / TSM Roadmap

## P0 — release safety
- Resolve LiDAR smoke-test and alternate-source recovery sequence.
- Verify the 23,082-feature identity and height evidence gate.
- Validate roof geometry, tileset, GLBs, artifact hashes, upload, and public deployment.

## P1 — platform foundations
- Enforce shared capability/provider contracts and consistent timeout/cancellation semantics.
- Add package-level contract tests and deterministic fixtures.
- Add database migration tests against supported PostgreSQL versions.
- Add SBOM, dependency provenance, and least-privilege release permissions.

## P2 — product surface
- Implement dashboard, docs, playground, and admin views against stable APIs.
- Add approval workflows, background jobs, notifications, quotas, and tenant-aware authorization.
- Add provider health checks, bounded caches, and operator observability.

## Acceptance policy
A roadmap item is complete only when implementation, tests, documentation, security review, and observable CI evidence exist. Directory creation alone is not completion.
