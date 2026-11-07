# Remaining branch review — 2026-11-07

Compared against main after PR #505, `4c111153d92d13a3a06158f4efe0d014945a9045`.

| Branch head | Disposition / evidence |
|---|---|
| `a2c45699bac068832bb761c6687c3ee848dfb86d` transvoxel | 0 commits ahead, 613 behind, no diff. Already reachable; another merge unnecessary. |
| `3db714a302538f013e2a9b7599c821c688ee1abc` authoritative fabric | 1 ahead, 20 behind; three registry/interface/document files. Opened PR #508 for normal review and CI. Capability declarations do not prove live services. |
| `4f85ac26532aa20d6de441fc6e64d61464142192` parallel semivariogram | Overlaps the modal merged by #505. Its TypeScript CRS guard allows EPSG:2966 while calling it metres, although that CRS is ftUS; it also admits arbitrary EPSG >=2000. The proposed residual migration is a DEM/survey structure while the available dataset is inter-product nDHM disagreement. Do not merge this competing implementation unchanged. Retain branch for reconciliation; use main's explicit ftUS-to-m method. |
| `53b7c6dd07bd6f06b6ae22d08460bc6c696eabce` bootstrap | Introduces another migration directory and tables also created differently by the ingestion branch. Renames existing `@tsm-uacf/contracts` and `@tsm-uacf/evidence-runtime` packages without verified workspace/consumer migration. Not ready for whole-branch merge. |
| `ff2df949b043a87cd578e0f7310c073262c60ccc` ingestion scaffold | OGR import uses `-overwrite`, validates only hash length in adapters, and returns `pending-db` asset/run IDs rather than persisted records. Resolve table ownership, manifest/datum validation, error handling and transactional evidence linkage before treating as operational ingestion. Not ready for whole-branch merge. |

Unique branch work is retained. None of these observations authorizes production schema changes or deletion of unique work. The optional DuckDB path does not deploy the bootstrap/server stack or silently promote its ingestion placeholders.
