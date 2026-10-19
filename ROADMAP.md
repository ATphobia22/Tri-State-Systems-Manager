# UACF / TSM Roadmap

## Incomplete technical gaps (do not claim complete)

Authoritative registry: [`docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md`](docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md)

| Gap | Status |
|-----|--------|
| Hierarchical-Z / GPU compute culling | **Not complete** — CPU depth pyramid and meshlet scaffolding exist; live GPU depth integration, browser/device validation, and performance evidence remain open |
| Transvoxel terrain stitching | **Partial** — Lengyel transition-cell table and 2:1 LOD scheduler exist; end-to-end county-scale mesh emission, seam validation, and performance evidence remain open |
| Full C/S state transitions | **Logic + bridge only** — variants/fetch bridge exist; bandwidth-adaptive streaming and full asset set incomplete |
| Coordinate validation | **Partial** — evidence schemas and batch harness exist; full-catalog report for CRS/datum/epoch/units/provenance remains open |
| Occlusion validation | **Partial** — renderer diagnostics and recovery scaffolding exist; multi-device correctness/performance profiles remain open |

## P0 — release safety
- Resolve LiDAR smoke-test and alternate-source recovery sequence.
- Verify the 23,082-feature identity and height evidence gate.
- Validate roof geometry, tileset, GLBs, artifact hashes, upload, and public deployment.
- Keep gap labels honest after every merge (see registry above).

## P1 — platform foundations
- Enforce shared capability/provider contracts and consistent timeout/cancellation semantics.
- Add package-level contract tests and deterministic fixtures.
- Add database migration tests against supported PostgreSQL versions.
- Add SBOM, dependency provenance, and least-privilege release permissions.
- Attach elevation evidence products (CRS, vertical datum, epoch, accuracy class) on every DEM/terrain path.

## P2 — product surface
- Implement dashboard, docs, playground, and admin views against stable APIs.
- Add approval workflows, background jobs, notifications, quotas, and tenant-aware authorization.
- Add provider health checks, bounded caches, and operator observability.
- Opt-in NFHL priority overlay on MapTwin; nightly `nfhl:validate` drift job.

## Completion sequencing\n\n1. **P0:** establish a green, exact-SHA CI baseline and production artifact provenance; repair failures before feature expansion.\n2. **P1:** finish geospatial evidence coverage and source-recovery tests using pinned authoritative datasets.\n3. **P1:** finish county-scale terrain/mesh tests with recorded data, output hashes, seam checks, and performance measurements.\n4. **P2:** finish GPU/browser/device integration only on supported hardware, with a CPU reference and measured compatibility matrix.\n5. **P2:** complete product/API surfaces only after stable provider contracts, authorization, migration tests, observability, and accessibility checks.\n\nThe detailed acceptance criteria for the five terrain/geospatial gaps are in the [technical gaps registry](docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md).\n\n## Acceptance policy
A roadmap item is complete only when implementation, tests, documentation, security review, and observable CI evidence exist. Directory creation alone is not completion. A PoC validates an approach; it does not constitute a complete subsystem.
