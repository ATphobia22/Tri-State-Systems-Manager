# Legacy scaffold reconciliation follow-up

Current disposition: the explicit code-history resolution in `docs/release/LEGACY-SCAFFOLD-RESOLUTION-2026-11-07.md` supersedes the historical branch statuses below.
Baseline: main `82756c0dd88d03d504607dc3fe12edef7b225c7e`.

This is a selective implementation of useful branch intent, not a whole-branch merge or deployed database claim. The three original branch heads remain retained for review.

| Legacy intent | Canonical implementation / disposition |
|---|---|
| Bootstrap migrations and government evidence tables (`53b7c6d`) | Preserve `scripts/run_migrations.py`, `packages/government/migrations/001_government_evidence_fabric.sql`, and `database/migrations/097_tsm_ingestion_gaps.sql`. Alternate service deployment and conflicting table definitions remain unresolved. Preserve existing `@tsm-uacf` package identities. |
| Ingestion worker (`ff2df94`) | Existing `packages/jobs/src/ingestion` has bytes-based manifests, explicit unavailable/rejected outcomes and append/update OGR loading. This follow-up adds destination identifier validation and redacts connection credentials from subprocess diagnostics. Legacy fake pending-db identifiers and overwrite imports are excluded. Live transactional PostGIS ingest remains separately unverified. |
| Parallel semivariogram (`4f85ac2`) | Existing #505 modal and Python workflow remain canonical. Add reusable, explicitly derived TypeScript math inside `packages/geo`, with allowlisted CRS/units and ftUS conversion. Do not import competing UI or survey-residual database schema. |
| Authoritative fabric (`3db714a`) | Incorporated via merged PR #508. Capability registry declarations do not prove availability or model validation. |

Semivariogram distances are projected grid metres, not survey-ground distances. Elevation values must already be comparable and use the same vertical units; gamma uses their squared units. The implementation computes inter-product disagreement, not certified survey accuracy. Empty bins are null; insufficient pairs remain flagged. It uses O(n²) pair enumeration and is intended for bounded sampled inputs. It does not estimate or fit model parameters.

Validation: 17 local tests pass (13 ingestion tests using a stub subprocess; 4 semivariogram tests). The dedicated CI repeats them. The subprocess fixture deliberately echoes fake credentials to verify redaction; this does not prove a real GDAL/PostGIS transaction. Native Windows Shipping, offline executable behavior, cinematic performance and full building coverage require their separate evidence.
