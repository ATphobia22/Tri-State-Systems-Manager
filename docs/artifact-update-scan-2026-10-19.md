# Artifact Update Scan — Historical Audit (2026-10-19)

**Status:** Historical snapshot, reviewed and superseded on 2026-10-22. Do not use the original findings below as a statement of current repository state.

## 1. BFE display and arithmetic findings — resolved in current code

The 2026-10-18 correction record identifies **369.1 ft NAVD88** in FEMA FIS 18129CV000A, Table 9, Section A as the current reference value, replacing the prior 375.0 ft working target. Current source files now use that reference in:

- `tsm-console/src/components/FloodScenarioAnimation.tsx`
- `tsm-console/src/components/CinematicTwinHud.tsx`
- `tsm-console/src/routes/CinematicView.tsx`
- `tsm-console/src/lib/flood-sim/workbench.ts`
- `tsm-console/src/types/site.ts`
- `tsm-console/src/lib/scientific-analytics.ts`
- `data/scenarios/q100-design-event.json`

The active regression tests and local-AI skill facts were also reconciled with the corrected reference. Arithmetic differences against owner-supplied elevations are LAG +8.1 ft, FFE +13.4 ft, and berm +10.7 ft. These are arithmetic only, not a survey, parcel-specific flood determination, or regulatory approval.

**Important unresolved site limitation:** the independently geocoded address point and the asserted surveyed centroid differ by approximately 6.4 km, and the sampled effective FIRM layer did not provide a usable BFE. Therefore, applicability of the FIS reference to the candidate parcel remains **unverified** pending certified survey/location reconciliation and review by the responsible authority.

## 2. Finished-floor elevation — owner-supplied, not independently verified

The 382.5 ft NAVD88 FFE remains owner-supplied. It must not be represented as survey-certified or as a verified regulatory fact without supporting records. Any arithmetic involving it must retain the owner-supplied provenance label.

## 3. Development tooling recommendations

A previous scan recommended evaluating `uv` for Python dependency management. This is a tooling recommendation, not a production blocker; adoption should be a separate reviewed change with reproducibility and lockfile verification.

## 4. Reference documentation and public artifacts

The previous scan identified reference documents that could be surfaced more clearly in the public dashboard. This remains a documentation/product decision and does not establish that any scientific, geospatial, or regulatory capability is production-complete.

## 5. Repository and deployment status

The prior scan's statements about a local-only commit, expired credentials, and published artifacts were point-in-time observations from 2026-10-19 and are not asserted as current. Current source changes must be evaluated against the live GitHub branch and its exact commit status.

## Release rule

Do not treat a queued or failed workflow as verification. Publish only artifacts built from the intended commit after the required checks pass. Missing, stale, owner-supplied, or spatially unverified evidence must remain visibly qualified and must not be promoted to an authoritative site conclusion.
