# UACF / TSM Roadmap

## Incomplete technical gaps (do not claim complete)

Authoritative registry: [`docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md`](docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md)

| Gap | Status |
|-----|--------|
| Hierarchical-Z / GPU compute culling | **Not complete** — WebGL2 occlusion queries exist; true H-Z blocked (no MapLibre WebGPU path) |
| Transvoxel terrain stitching | **PoC only** — density contract + 2:1 LOD scheduler exist; Lengyel 73-class transition tables not production |
| Full C/S state transitions | **Logic + bridge only** — variants/fetch bridge exist; bandwidth-adaptive streaming and full asset set incomplete |
| Coordinate validation | **Partial** — local-frame + canonical CRS guards; system-wide CRS/datum/epoch/survey accuracy evidence incomplete |
| Occlusion validation | **Partial** — context-loss recovery exists; multi-device profiling incomplete |

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

## Acceptance policy
A roadmap item is complete only when implementation, tests, documentation, security review, and observable CI evidence exist. Directory creation alone is not completion. A PoC validates an approach; it does not constitute a complete subsystem.
