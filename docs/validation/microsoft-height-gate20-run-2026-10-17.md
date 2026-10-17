# 20 m gate calculation — executed 2026-10-17

## Inputs

| Source | Count used |
|--------|------------|
| TSM `buildings-3d.json` (Pages) with `height_m > 0` | **22,815** |
| Microsoft quadkey `032000212` with `height > 0` | **24,583** |

## Algorithm (executed)

1. Centroid of each footprint polygon (average of outer ring vertices).
2. Local planar meters near Posey.
3. 50 m grid index on Microsoft points.
4. For each TSM building, search 3×3 cells; take nearest MS centroid.
5. **Match iff** distance ≤ **20 m** and both heights > 0.
6. Residual `|h_TSM − h_MS|`.

## Sample (seed=42, n=1000)

| Metric | Value |
|--------|--------|
| Matched | **244** (**24.4%**) |
| Median \|Δh\| | **0.942 m** |
| Mean \|Δh\| | **1.67 m** |
| Within 2 m | **77.9%** |
| P90 \|Δh\| | **3.07 m** |
| Median match distance | **3.33 m** |

## Full inventory

| Metric | Value |
|--------|--------|
| Matched | **5,566 / 22,815** (**24.4%**) |
| Median \|Δh\| | **1.038 m** |
| Within 2 m | **76.1%** |

Reproduces published cross-check (≈24% match, ≈0.92–1.0 m median). Authority: **DERIVED / screening**.
