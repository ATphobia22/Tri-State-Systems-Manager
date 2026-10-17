# Effect of the 20 m nearest-centroid match gate

Used in TSM Microsoft height cross-check: pair a TSM building to the nearest Microsoft footprint centroid **only if** distance ≤ **20 meters**.

## What the gate does

```text
for each TSM building centroid C_t:
  find Microsoft centroid C_m minimizing distance(C_t, C_m)
  if distance > 20 m → NO MATCH (excluded from height Δ statistics)
  else → MATCH (include |h_tsm − h_ms| in median/mean)
```

## Effects

| Effect | Direction |
|--------|-----------|
| Reduces false pairs (wrong building) | **Improves** height-Δ validity |
| Rejects large rural footprints with distant centroids | **Lowers** match rate |
| Rejects split/merged footprints (farm complex vs one polygon) | **Lowers** match rate |
| Rejects systematic footprint offset between detectors | **Lowers** match rate |
| Makes 24% match rate a **join statistic**, not a height-quality score | Correct interpretation |

## Sensitivity (conceptual)

| Gate | Expected match rate | Risk |
|------|---------------------|------|
| 5–10 m | Lower | Misses valid pairs with modest footprint disagreement |
| **20 m** | Medium (observed 24%) | Balance used in TSM doc |
| 50–100 m | Higher | More wrong-building pairs → polluted Δh |

## Relation to height accuracy

The gate **does not measure** LiDAR vs ML accuracy. It only decides **which pairs enter** the accuracy sample. After the gate, median |Δh| = 0.92 m on 240 pairs is the accuracy signal.

## Recommendation

Keep 20 m for screening publications. If re-running, report match rate at 10 / 20 / 50 m as a sensitivity table without changing authority class (DERIVED / screening).
