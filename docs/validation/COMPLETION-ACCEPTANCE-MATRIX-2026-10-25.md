# TSM completion acceptance matrix — 2026-10-25

This matrix is a release-work queue, not a declaration of completion. Source: main README, docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md, and docs/architecture/TECHNICAL-RELEASE-GATES.md reviewed 2026-10-25.

## P0 — correctness and evidence
- [ ] Review and merge USGS OGC observation-validation fix (#404) only after its test workflow passes at the exact PR SHA; reject fabricated zero, absent timestamp, mismatched station/parameter and misassigned discharge datum.
- [ ] Review and merge offline source integrity / historical OGC migration (#403) after exact-SHA CI and security review; verify SHA-256, source vintage and feature-count behavior.
- [ ] Resolve 23,082-building acceptance schema drift and run complete chain against immutable inputs; publish measured count, missing feature IDs and hashes.
- [ ] Resolve the Point Township historical record with null vertical datum using authoritative evidence or mark affected computations unavailable; never infer NAVD88.
- [ ] Preserve unavailable/degraded states for absent sources; reject contradictory evidence and do not promote unreviewed outputs to certified/regulatory results.

## P1 — measured geometry and runtime
- [ ] Run full 7,453-building LOD2 production bake with reproducible inputs, validation report, and checksums.
- [ ] Complete county-scale adaptive-octree Transvoxel extraction and all-six-orientation seam tests using authoritative DEMs; record nodata exceptions.
- [ ] Complete provider coverage, online/offline transitions, long-running cache behavior and data-freshness tests.
- [ ] Validate GPU H-Z against CPU reference with real scene depth, lifecycle/context-loss tests, and device-specific performance traces.
- [ ] Profile low/mid/high tier supported devices; record frame-time percentiles, memory and failure conditions.

## P2 — distribution
- [ ] Verify native Windows 11 x64 Unreal runtime and offline installer on a clean target device; publish SHA-256 inventory and installation/rollback evidence.
- [ ] Validate public Pages subpath, anonymous access, offline fallback, and opt-in external photorealistic sources.
- [ ] Publish a release candidate with pinned commit SHA, CI workflow URLs, test summaries, known limitations, input dataset vintages and artifact checksums.

## Required per-gate evidence
Each checked item must link to a commit SHA, executable command, successful CI run on that SHA, input snapshot/checksum, generated output and a reviewer. Hardware- or data-dependent gates remain UNVERIFIED when no execution evidence exists. Green CI does not constitute surveying, professional engineering certification, FEMA determination, or emergency warning validation.

## Pull-request handling
Do not bulk-merge open PRs. Confirm dependency compatibility, diff review, required checks, and absence of overlap before merging. Do not delete branches until merged commits and dependent workflows are verified.

## Scientific safeguards
Keep horizontal CRS, vertical datum, epoch, units, geoid model and source metadata attached to every numerical elevation. Stage-to-WSE conversion requires verified station gage-zero evidence. Human review remains final for consequential engineering and regulatory decisions.
