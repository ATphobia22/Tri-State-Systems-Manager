# Repository Duplicate Audit — 2026-10-18

## Scope and method

Audited the live `ATphobia22/Tri-State-Systems-Manager` repository using the GitHub REST tree for `main`, branch heads, all open pull requests, PR changed-file lists, base/head commit comparisons, and blob SHA comparisons for high-overlap paths. This is a repository-state snapshot, not a claim that all runtime functionality or all workflows are green.

- Audited main SHA: `e68f24a1b8cee2700118fb2bd82abd2cef3958a4`
- Main tree entries: 10,276
- Branches visible at audit time before this audit branch was created: 11 (including `main`); the audit branch and HLOD test branch were added afterward
- Open PRs before cleanup: 6
- Exact duplicate blob groups in the main tree: 68

An exact blob duplicate is a byte-identical file at more than one path. It is not automatically a defect: identical templates, empty package markers, copied public assets, and repeated tile payloads can be intentional.

## Pull-request decisions

| PR | Decision | Evidence / rationale |
|---|---|---|
| #291 — renderer mainline | Closed as superseded | The HLOD builder and geometric-error test are byte-identical to main; both workflows already run the test. The branch is 151 commits behind main and its remaining workflow/documentation differences are stale. |
| #293 — hierarchical voxel visibility | Closed as superseded | The LOD scheduler is byte-identical to main and the test differs only at blob metadata, not line content. Its documentation is stale relative to current main and its lockfile change would replace a pinned Three.js dependency with a range. |
| #294 — mapping-plane HLOD release gates | Closed as superseded | The implementation register and HLOD test are byte-identical to main. Its alternate implicit-tileset builder/test are older than main's current state-word and metadata contract; merging them would regress current implementation. |
| #295 — HLOD geometric-error contract | Closed as superseded after salvage | Production builder is byte-identical to main. Its stronger regression cases were ported into PR #301 without merging the stale, divergent branch. |
| #298 — HLOD renderer hardening rebased | Closed as superseded | Its camera basis helper is already on main; its renderer layer and scheduler are substantially older. The added `state-word.ts` uses a bit layout that conflicts with main's `state-word-codec`, so wholesale merge is unsafe. Any needed behavior must be reimplemented in a focused PR against main. |
| #300 — hydrology source consistency / AOI readiness | Retain for CI review | Hydrology source, API migration, manifest, and AOI-readiness changes are not duplicates of the renderer work. Must pass the current CI head before merge. |
| #301 — HLOD regression coverage | Retain for CI review | Test-only salvage of stronger deterministic/error-bound cases from #295. Current CI must be green before merge. |

PRs #291, #293, #294, #295, and #298 were closed as superseded during this audit. PR #301 was consolidated into #300 so the HLOD regression test runs with the dependency-lockfile repair. No stale branch was merged merely to make a PR appear complete.

## Branch-level assessment

The following branches are stale/diverged and should not be bulk-merged:

- `feat/hierarchical-voxel-visibility-2026-10-18`: scheduler already exists on main; branch includes stale docs and a lockfile regression.
- `feat/mapping-plane-hlod-release-gates-2026-10-18`: current register and HLOD test are on main; older implicit-tileset implementation must not replace current main.
- `fix/hlod-geometric-error-contract`: production builder already matches main; stronger tests salvaged to PR #301.
- `fix/3d-tiles-renderer-mainline`: HLOD builder/test and CI test wiring are already present on main; PR #291 closed.
- `fix/3d-tiles-hlod-renderer-hardening`: PR #297 closed; this branch ref was observed at the same SHA as main at audit time.
- `fix/3d-tiles-hlod-renderer-hardening-rebased`: stale and non-mergeable; PR #298 closed. Its `state-word.ts` bit layout conflicts with main and must not be merged wholesale.
- `fix/maplibre-three-peer-dependency` and `fix/state-word-paper-layout`: old divergent branches whose earlier PRs were superseded/closed; do not merge without a fresh per-file diff against current main.
- `feat/on-demand-hydrology-snapshots-20261018`: no open PR; compared with the active hydrology branch, it shares the same merge base and differs in only three files. It is a near-duplicate snapshot branch; after PR #300 is validated/merged, retire this stale ref rather than merge both.
- `fix/hydrology-source-consistency-and-aoi-readiness-20261018`: active hydrology PR #300.
- `docs/repository-duplicate-audit-2026-10-18`: this report branch.
- `main`: protected default branch.

The available GitHub connector does not expose a branch-deletion action. Therefore this audit closes redundant PRs but does not claim to have deleted stale branch refs.

## Exact duplicate-content groups: interpretation

The 68 blob groups include both harmless duplication and data-copy pairs that need drift controls. Representative cases:

- **Likely intentional templates:** repeated plugin `tsconfig.json` files.
- **Identical source/public copies requiring sync checks:** Posey County quadrangle GeoJSON; USACE leveed-areas GeoJSON and provenance; authority registry root/console copies.
- **Potentially intentional duplicated research/source material:** the same USGS SIR PDF in download and fabric-report directories.
- **Generated 3D Tiles payloads:** many identical subtree/binary blobs; content-address equality alone does not prove incorrect tiling. Validate tile coordinates, subtree availability, and content references instead of deleting repeated blobs.
- **Example/schema equality:** files under `data/schemas/examples/` that are byte-identical to live configuration deserve explicit fixture-versus-instance intent documentation, so future edits do not accidentally treat an example as the authoritative runtime config.

## High-priority follow-up

1. Add CI contracts for source/public-copy synchronization where duplication is intentional; do not remove copies until deployment paths and consumers are verified.
2. Do not merge the stale state-word scheduler in PR #298; if needed, add tests against main's current `state-word-codec` and renderer architecture.
3. Wait for PR #300 CI, inspect all test failures, and only merge after its exact head passes required checks.
4. Wait for PR #301 CI; its initial parse-gate attempt failed during locked dependency installation before the regression tests ran, so that attempt did not validate the new tests.
5. Run a complete branch-ref cleanup after review. Branch deletion is not available through the currently connected GitHub action set.

## External source checks used for hydrology-related duplicate/data correctness

- USGS modern Water Data API migration: https://api.waterdata.usgs.gov/docs/ogcapi/migration/
- USGS Water Data API docs: https://api.waterdata.usgs.gov/docs/
- NOAA NWPS API docs: https://api.water.noaa.gov/nwps/v1/docs/
- USGS 3DEP datum/resolution guidance: https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model
- USACE National Levee Database data services: https://levees.sec.usace.army.mil/data-services/services/

These sources describe available products and API contracts; they do not establish that TSM's runtime integration is live or that any AOI has been approved for hydraulic modeling.
