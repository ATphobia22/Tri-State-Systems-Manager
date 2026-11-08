# Explicit legacy branch merge resolution

This resolves code history and implementation ownership for three diverged branches. Their commits are retained as merge parents. The resolved tree keeps the canonical implementations below; it does not deploy their discarded alternate services or migrate an existing operator database. The adjacent file-disposition JSON enumerates every changed file from GitHub's exact-head comparisons.

| Original head | Resolution |
|---|---|
| bootstrap `53b7c6dd07bd6f06b6ae22d08460bc6c696eabce` | Canonical migration runner, contracts, hashing and datum validation supersede the alternate stack. Decline its default-password environment file, duplicate Compose services, parallel public migration ledger, conflicting SQL tables, package renames and services workspace expansion. |
| ingestion `ff2df949b043a87cd578e0f7310c073262c60ccc` | Keep `packages/jobs/src/ingestion`, `packages/queues` and bytes-oriented manifests. Decline destructive OGR overwrite, fake pending-db identifiers and conflicting imported-assets/run tables. Keep the direct PMTiles builder rather than adding an unconnected MBTiles conversion helper. |
| semivariogram `4f85ac26532aa20d6de441fc6e64d61464142192` | Keep the integrated EPQS warning modal and tested Python workflow from #505; use the unit-aware TypeScript implementation from #509. Decline parallel package exports and the survey-residual schema, because inter-product nDHM disagreement cannot be relabeled survey residuals. |

## Functional ownership

| Legacy files / intent | Resolved implementation |
|---|---|
| bootstrap `.env.bootstrap.example`, `docker-compose.bootstrap.yml`, `scripts/bootstrap-start.sh`, `docs/BOOTSTRAP-STACK.md` | Declined alternate mandatory server stack. `tsm-native/config/native-product-contract.json` requires local native runtime; existing optional preview deployment stays separate. No implicit Redis/PostGIS/Martin deployment. |
| bootstrap `database/migrations/001_core.sql`, `002_indexes.sql`; ingestion `db/migrations/120_core_ingestion.sql`, `121_ingestion_indexes.sql` | Preserve `packages/government/migrations/001_government_evidence_fabric.sql`, `database/migrations/097_tsm_ingestion_gaps.sql` and the existing evidence schemas. The two proposed public ingestion_runs definitions conflict with the canonical source-linked schema. No automatic schema conversion or operational SQL publication is claimed. |
| bootstrap `services/migration-runner/**` | `scripts/run_migrations.py`: canonical ledger bootstrap, digest comparison, source-byte recheck, advisory lock and transactional SQL/ledger writes. |
| bootstrap `services/ingestion-worker/**`; ingestion worker/types/registry/index/adapters | `packages/jobs/src/ingestion/**`, `packages/contracts/src/IngestionManifest.ts`. Explicit unavailable/rejected states, observed hashes/counts, OGR append/update, destination checks and redacted diagnostics. Manifest run IDs remain deterministic identifiers, not persisted database UUIDs. |
| bootstrap package manifests / pnpm services glob; `packages/geodesy/package.json`; ingestion package manifest | Preserve the current workspace and `@tsm-uacf/contracts`, `@tsm-uacf/evidence-runtime`, `@tsm/geo`, `@tsm/jobs`, `@tsm/queues` identities. No old-namespace consumers require a compatibility facade. |
| bootstrap HashService | `packages/jobs/src/ingestion/adapters/geojson.ts` exports raw-byte sha256Hex; `packages/evidence-runtime/src/EvidenceCollector.ts` provides canonical evidence hashing. Preserve their distinct digest contracts. |
| bootstrap DatumValidator | `packages/geo/src/geodesy/DatumValidator.ts` and existing reference/datum contracts. |
| ingestion queue factory | `packages/queues/src/index.ts`: offline MemoryQueue plus optional Redis adapter; no required daemon. |
| ingestion `jobs/pmtiles.ts` | `scripts/geospatial/build_pmtiles.py` and `validate_pmtiles.py`: direct immutable archive path. MBTiles-to-PMTiles convenience conversion is not installed as a second job system. |
| ingestion architecture document | This resolution, the canonical ingestion source contracts and migration repair documentation replace the unimplemented scaffold's operational narrative. |
| semivariogram Python fit | `scripts/geospatial/semivariogram_ndhm_disagreement.py`: weighted spherical/exponential fitting and uncertainty disclosure; its existing tests verify parameter recovery. |
| semivariogram TS / index | `packages/geo/src/geodesy/semivariogram.ts`: explicit allowlisted CRS units, ftUS conversion, sparse/empty-bin handling and derived-only output. |
| semivariogram EPQS modal / architecture document | Integrated `tsm-console/src/components/EpqsBfeWarningModal.tsx` and `FloodSimulator.tsx`; preserve #505's current warning and source distinctions. |
| semivariogram `db/migrations/122_elevation_residuals_uncertainty.sql` | Declined: supplied data are inter-product disagreement, not independent survey control. No fictional residual database is introduced. |

Validation for the resolved implementations: 38 local TypeScript ingestion/geodesy/evidence/kernel tests and four PMTiles builder tests passed. The migration CI job passed all 18 unit/PostgreSQL tests. All ordinary repository migration wrappers parse under the new runner. No full production PostGIS migration, transactional asset promotion, Redis deployment, native Shipping binary, survey certification or full building acceptance is asserted.

Historical branch-audit documents describe their earlier checkpoints. This resolution supersedes their pending branch disposition. Branch refs can remain for traceability after their exact commits are reachable from main; no unique commit history is deleted.
