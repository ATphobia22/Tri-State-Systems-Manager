# Repository Duplicate Audit — 2026-10-18

## Scope and method

Audited the live `ATphobia22/Tri-State-Systems-Manager` repository using the GitHub REST tree for `main`, branch heads, all open pull requests, PR changed-file lists, base/head commit comparisons, and blob SHA comparisons for high-overlap paths. This is a repository-state snapshot, not a claim that all runtime functionality or all workflows are green.

- Audited main SHA: `e68f24a1b8cee2700118fb2bd82abd2cef3958a4`
- Main tree entries: 10,276
- Baseline branch count at initial scan: 11 (including `main`); subsequent work added the audit, HLOD-test, and on-demand hydrology branches.
- Current branch count at this refresh: 14 (including `main`).
- Current open PRs at this refresh: #302 (this audit) and #303 (on-demand hydrology); redundant #300 and #301 have been closed/consolidated.
- Exact duplicate blob groups in the main tree: 68.
- Exact duplicate blob groups in the main tree: 68; all groups and paths are inventoried in `artifacts/repository-duplicate-audit-2026-10-18.json`

The JSON artifact lists every duplicate SHA, all matching paths, blob size, group count, and a cautious path-based triage label. An exact blob duplicate is a byte-identical file at more than one path. It is not automatically a defect: identical templates, empty package markers, copied public assets, and repeated tile payloads can be intentional.

## Pull-request decisions

| PR | Decision | Evidence / rationale |
|---|---|---|
| #291 — renderer mainline | Closed as superseded | The HLOD builder and geometric-error test are byte-identical to main; both workflows already run the test. The branch is 151 commits behind main and its remaining workflow/documentation differences are stale. |
| #293 — hierarchical voxel visibility | Closed as superseded | The LOD scheduler is byte-identical to main and the test differs only at blob metadata, not line content. Its documentation is stale relative to current main and its lockfile change would replace a pinned Three.js dependency with a range. |
| #294 — mapping-plane HLOD release gates | Closed as superseded | The implementation register and HLOD test are byte-identical to main. Its alternate implicit-tileset builder/test are older than main's current state-word and metadata contract; merging them would regress current implementation. |
| #295 — HLOD geometric-error contract | Closed as superseded after salvage | Production builder is byte-identical to main. Its stronger regression cases were ported into PR #303 without merging the stale, divergent branch. |
| #298 — HLOD renderer hardening rebased | Closed as superseded | Its camera basis helper is already on main; its renderer layer and scheduler are substantially older. The added `state-word.ts` uses a bit layout that conflicts with main's `state-word-codec`, so wholesale merge is unsafe. Any needed behavior must be reimplemented in a focused PR against main. |
| #300 — hydrology source consistency / AOI readiness | Closed as superseded | Its API migration, manifest, AOI evidence, and HLOD test were consolidated into the broader user-triggered snapshot implementation in #303. |
| #301 — HLOD regression coverage | Closed as consolidated | Its test-only regression coverage was ported into #303 so the test runs with the on-demand hydrology changes and pinned npm workflow. |

PRs #291, #293, #294, #295, and #298 were closed as superseded during this audit. PR #301 and the useful source/API changes from #300 were consolidated into #303. #303 must pass its exact-head CI before merge. No stale branch was merged merely to make a PR appear complete.

## Branch-level assessment

The following branches are stale/diverged and should not be bulk-merged:

- `feat/hierarchical-voxel-visibility-2026-10-18`: scheduler already exists on main; branch includes stale docs and a lockfile regression.
- `feat/mapping-plane-hlod-release-gates-2026-10-18`: current register and HLOD test are on main; older implicit-tileset implementation must not replace current main.
- `fix/hlod-geometric-error-contract`: production builder already matches main; stronger tests consolidated into active PR #303 via closed PRs #301 and #300.
- `fix/3d-tiles-renderer-mainline`: HLOD builder/test and CI test wiring are already present on main; PR #291 closed.
- `fix/3d-tiles-renderer-hardening`: this ref was observed at main's SHA at one audit checkpoint, but later changed to a different SHA; recompare its current tree before any branch cleanup.
- `fix/3d-tiles-hlod-renderer-hardening`: PR #297 closed; branch remains stale/diverged and should not be merged wholesale.
- `fix/3d-tiles-hlod-renderer-hardening-rebased`: stale and non-mergeable; PR #298 closed. Its `state-word.ts` bit layout conflicts with main and must not be merged wholesale.
- `fix/maplibre-three-peer-dependency` and `fix/state-word-paper-layout`: old divergent branches whose earlier PRs were superseded/closed; do not merge without a fresh per-file diff against current main.
- `feat/on-demand-hydrology-snapshots-20261018`: active PR #303. This is the fuller on-demand hydrology implementation; it keeps read-only snapshots user-triggered and leaves automatic polling prohibited. NOAA forecast/tile publication remains pending until a live receipt and verification are captured.
- `fix/hydrology-source-consistency-and-aoi-readiness-20261018`: PR #300 closed as superseded by #303; do not merge both overlapping branches.
- `docs/repository-duplicate-audit-2026-10-18`: PR #302 contains this report, duplicate-blob inventory, and data-copy parity check.
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

1. **Implemented on the audit branch:** `scripts/ci/validate-data-copy-parity.mjs` checks four intentional source/public mirrors (quadrangle GeoJSON, leveed-area GeoJSON, leveed-area provenance, and authority registry). It fails on drift and never auto-copies over a source. Verify the script is present in the PR diff and passes CI before merging.
2. Do not merge the stale state-word scheduler in PR #298; if needed, add tests against main's current `state-word-codec` and renderer architecture.
3. Wait for PR #303 CI, inspect all test failures, and only merge after its exact head passes required checks. A previous FEMA verification attempt failed during `npm ci` because the runner's npm version was not pinned; PR #303 pins npm 10.9.2 in that workflow.
5. Run a complete branch-ref cleanup after review. Branch deletion is not available through the currently connected GitHub action set.

## External source checks used for hydrology-related duplicate/data correctness

- USGS modern Water Data API migration: https://api.waterdata.usgs.gov/docs/ogcapi/migration/
- USGS Water Data API docs: https://api.waterdata.usgs.gov/docs/
- NOAA NWPS API docs: https://api.water.noaa.gov/nwps/v1/docs/
- USGS 3DEP datum/resolution guidance: https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model
- USACE National Levee Database data services: https://levees.sec.usace.army.mil/data-services/services/

These sources describe available products and API contracts; they do not establish that TSM's runtime integration is live or that any AOI has been approved for hydraulic modeling.
