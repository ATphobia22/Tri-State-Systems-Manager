# TSM PointTube Temporal Contract

**Date:** 2026-10-07
**Module:** `scripts/geospatial/point_tube.py`

## Purpose

PointTube carries spatio-temporal state for TSM features (building elevation
trajectories, flood crest observations, terrain change). It is a **data
structure with strict semantics**, not a simulation engine.

## State types

| State | Meaning | May interpolate numerically? |
|---|---|---|
| `OBSERVED` | Direct measurement (LiDAR return, survey shot) | Yes (as anchor) |
| `DERIVED` | Computed from observations (median roof-ground height) | Yes (as anchor) |
| `INTERPOLATED` | Linear blend between two OBSERVED/DERIVED anchors | N/A (output only) |
| `FORECAST` | Model-projected future state | No |
| `SIMULATED` | Synthetic scenario state | No |
| `EVENT` | Discrete occurrence anchored to a timestamp | No |

## Hard rules

1. **Categorical state is never interpolated.** `get_state_at(t)` returns the
   state of the sample whose validity interval contains `t`. It does not
   blend `OBSERVED` with `SIMULATED`.
2. **Numeric interpolation only between OBSERVED/DERIVED anchors**, using the
   declared method (currently `linear`). Interpolated samples are labeled
   `INTERPOLATED` with `confidence: INTERPOLATED` and source
   `interpolated(A -> B)`.
3. **Out-of-range timestamps raise `TemporalRangeError`.** No silent
   extrapolation. A tube covering 2020–2023 refuses `t=2025`.
4. Every sample records: timestamp, validity interval, state type, source,
   confidence, interpolation method.

## Branch interaction

`SIMULATED` and `FORECAST` samples may exist in a tube for scenario analysis,
but the authority-boundary validator (`docs/TSM-BRANCH-ISOLATION.md`) ensures
they never enter the authoritative 23,082 feature set. A tube containing only
`SIMULATED` samples has no `OBSERVED`/`DERIVED` anchors and therefore refuses
all `get_position_at` calls.
