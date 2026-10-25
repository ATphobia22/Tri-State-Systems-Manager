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

## Integration audit — 2026-10-25 (post-merge, not release approved)

- GitHub open pull requests: **0** after integrating #396, #390, #403, #404 and reconciliations #405, #406, #407, #408, #409, #410, #411. 
- The remaining historical feature/fix branches are **behind main with 0 unique commits**; branch references are not equivalent to unmerged work.
- CodeQL on original #410 source head `b785f18dd035717803e14a9056b20a4ef8112f06` reported **1 new high-severity alert** (check run 121203655950). Track exact rule, reproduction and remediation in issue #412: https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/412. Do not assert false-positive without evidence.
- Main's API-generated OpenAPI synchronization bot committed `c9c91e8311a8a0d39743ebff7e1c72e4b83aa78a` with `[skip ci]`; prior-parent checks cannot prove that commit green. This status-document update deliberately creates a fresh main SHA to permit the configured push checks to run.
- All requirements in this acceptance matrix remain evidence-gated: no claim of 23,082-building production acceptance, LOD2 county bake, native UE5.8 distribution, hardware performance qualification, survey-grade vertical-datum evidence or regulatory approval without explicit measured artifacts.

**Release classification: NOT VERIFIED GREEN / SECURITY REVIEW REQUIRED** until a current main commit has passing required checks, security alert triage, and artifact integrity attestations.

## 2026-10-25: reproducible milestone evidence and outstanding hard gates

### Completed, supported by artifacts

- Canonical CI, visual E2E, CodeQL, Pages deployment workflow, offline-runtime packaging and source-recovery jobs were successful on commit `5d9a45096c235af8b91594b8d0fffab1d625d03a`. Individual workflow provenance is visible under https://github.com/ATphobia22/Tri-State-Systems-Manager/actions. **Do not use those runs to claim later commits green.**
- The Windows x64 *Tauri/Vite/Node offline runtime* job uploaded artifact `12605145315` (754,398,798 bytes ZIP; archive SHA-256 `00d5db1e0148770789645af7bcfa25750a0c251b7bf8b619c3b0601eb21e4517`). This artifact is **not** a cooked UE5.8 Shipping release.
- PR #413 remediated CodeQL's uncontrolled evidence-intake path and added replay/collision/unsafe-case ID tests; the PR-head CodeQL and canonical `build-and-test` checks passed. Confirm alert #114's current disposition in issue #412 before closing the security follow-up.
- PR #415 removed auto-pushed `[skip ci]` OpenAPI updates and replaced them with a reviewable, read-only exact-contract validator.
- PR #417 merged as `46fcc621ce40d9107c59616fd91019ec3c920e9c`, adding production Transvoxel API regression tests and deterministic count/OBJECTID audit. CI demonstrated 12 production-bridge/CLI tests and 7 synthetic identity tests passing. Source and published objects match on **22,815 identities**, and the archive-backed audit found **267 missing**, **0 extra** and **0 duplicate** source IDs.
- The archived IGIO-labeled release asset has SHA-256 `d8a46b86616becfdea9c9164e7a219317d5963b86fba47e4c1f8f880ccbb559f`; the published screening GeoJSON has SHA-256 `27e3cb85de9f8bfcfc51c50488786e79d59bf3ec976855f4644fe98cea394a53`. The complete 267-ID delta and both hashes are committed in `data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json` and checked against CI run https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40211424871.

### Release blockers, not to be silently cleared

- **UE5.8 Shipping/Windows 11 x64:** actual packaged native executable, certified build runner, offline launch, installed data/hash chain, hardware/cinematic and signer evidence remain unverified. Track issue #414. Epic UAT `BuildCookRun` requires a working engine/toolchain on an authorized runner.
- **Geospatial 23,082 full chain:** 267 IDs now diagnosed, but real individual height, geometry, vertical-datum evidence, LOD and stitched/GLB/HLOD production acceptance remain unfinished. Track issue #416; keep the partial screening layer `INFORMATIONAL_ONLY`.
- **Residential AOI public data:** an owner-directed disclosure override exists in `docs/privacy/site-anchor-public-disclosure.md`. Review its continued applicability before broader anonymous distribution. Working-tree edits do not erase published assets or Git history. Track issue #418; do not reproduce private identifiers in public status reports.
- **Security dashboard:** exact CodeQL alert disposition and all current-head workflow checks must be inspected separately. Track issue #412.
- **Engineering/regulatory use:** survey-grade source vetting, GEOID/datum conversion tests, authoritative HEC calibration/verification, uncertainty, and licensed human determination require real records beyond CI contract tests.

**Classification:** the implementation and regression/evidence gates above are complete where proven; **the overall native engineering product is not released or professionally certified** until remaining hardware, data, privacy and scientific gates have verifiable artifacts.
