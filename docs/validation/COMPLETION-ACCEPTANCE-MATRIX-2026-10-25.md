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
