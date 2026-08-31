# PDAL pipelines — TSM / Bonebank LOMA

## Optimization rules

1. **Crop early** — `filters.crop` (or reader bounds) before class/stats on large QL2 tiles.
2. Prefer **`filters.expression`** (`Classification == 2`) over legacy `filters.range` (deprecated toward PDAL 3.0).
3. Use **stream mode** when stages are streamable (`filters.expression`, crop, many writers) to avoid loading full clouds.
4. Write **LAZ** (`compression: laszip`) for intermediate products.
5. Set reader **`threads`** for LAZ decode (default ~7).
6. Declare **`default_srs` / `override_srs`: EPSG:2966** explicitly for Indiana West products.
7. For LAG: Class 2 only inside **foundation ± 50 ft** buffer; do not use whole-tile min as structure LAG.
8. Tile `IN2020_26800940_12`: structure LAG **377.2 ft is outside** low-ground tile max (~366.5 ft) — always pull adjacent higher tiles.

## LAG formula

$$\mathrm{LAG} = \min(Z_{\mathrm{Class2} \cap \mathrm{buffer}}),\quad \Delta_z = \mathrm{LAG} - \mathrm{BFE}$$

FEMA LOMA when \(\Delta_z \ge 0\); Indiana freeboard for new floors: LFE \(\ge\) BFE + 2.0 ft.

## Run

```bash
pdal pipeline pipelines/pdal/lag_extract_optimized.json \
  --readers.las.filename=/path/to/IN2020_26800940_12.las \
  --filters.crop.polygon="POLYGON((...))"
```

Replace polygon with surveyed foundation buffer in EPSG:2966 US ft.

See also: [STREAM-MODE.md](./STREAM-MODE.md) for stream vs standard processing.

See also: [HEC-RAS-AND-LIDAR-CLASSIFICATION.md](../docs/HEC-RAS-AND-LIDAR-CLASSIFICATION.md) or sibling docs path.

Full config + mesh notes: [PDAL-PIPELINE-AND-HEC-RAS-MESH.md](../../docs/PDAL-PIPELINE-AND-HEC-RAS-MESH.md).

SMRF tuning: [SMRF-PARAMETER-TUNING.md](../../docs/SMRF-PARAMETER-TUNING.md).
