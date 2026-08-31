# Indiana 3DEP Lidar — products & accuracy (TSM)

Source: *Indiana 3DEP Lidar Data Products, Data Accuracy, and Data Access* (updated 2021-06-08).

## Products

1. Lidar tiles — LAS 1.4, **QL2** (≥ 2 pulses/m²)
2. DEM tiles — bare-earth hydro-flattened IMG
3. Breaklines — rivers/lakes for hydro-flattening
4. Intensity tiles — 2.5 ft TIF from first return
5. County DEM mosaic
6. Delivery tile grid shapefile
7. FGDC metadata

Collection years mapped statewide: 2016–2020 (NRCS / USGS 3DEP / Woolpert).

## QL2 absolute vertical accuracy (3DEP spec)

| Metric | Spec |
|--------|------|
| RMSE_z (non-vegetated) | ≤ 0.100 m / **0.328 ft** |
| NVA 95% | ≤ 0.196 m / **0.643 ft** |
| VVA 95th percentile | ≤ 0.300 m / **0.984 ft** |

Practical guidance from the sheet: elevations in final QL2 products should generally be within **~1 ft** of true ground, but **AOI-specific NSSDA checks** are still required before LOMA-grade use.

## TSM implications

- Site constants BFE **375.0** / LAG **377.2** ft NAVD88 remain **regulatory/site** values, not LiDAR tile mins.
- Bonebank tile `IN2020_26800940_12` is low-ground; LAG sits **outside** tile max — adjacent tiles + sealed survey required.
- PDAL Class 2 + foundation buffer remains the LAG extraction path.
- Free data via Indiana GIO, Purdue tiles, OpenTopography (2011–13), USGS National Map, IndianaMap REST.

## Citation

USDA-NRCS Indiana, IGIC, USGS 3DEP; contractor Woolpert LLC. Products free of charge / without use restrictions per the fact sheet.

See also: [HEC-RAS-AND-LIDAR-CLASSIFICATION.md](../docs/HEC-RAS-AND-LIDAR-CLASSIFICATION.md) or sibling docs path.
