# SMRF classification + PDAL vs LAStools

## SMRF point classification (explain)

**SMRF** (Simple Morphological Filter, Pingel et al. 2013) builds a progressive **minimum surface** from the point cloud on a grid, then labels points as ground vs object by comparing each point’s elevation to that surface using slope-aware thresholds.

Conceptual steps:

1. Bin points into cells (`cell`).  
2. Morphological openings with growing windows up to `window` (largest object scale to remove).  
3. Height allowance grows with slope parameter; `threshold` and `scalar` tighten/loosen acceptance.  
4. Points near the progressive ground surface → **Classification = 2** (ASPRS ground); others → non-ground (often 1).

**TSM use:** reclassify only when vendor 3DEP Class 2 fails QA. Prefer:

`ELM → outlier → SMRF → expression(Classification == 2)`.

Floodplain-ft preset lives in `tsm-console/pipelines/pdal/ground_reclassify_smrf.json`.  
Full knob guide: `tsm-console/docs/SMRF-PARAMETER-TUNING.md`.

LAG math stays:

\[
\mathrm{LAG}=\min(Z_{\mathrm{Class2}\cap\mathrm{buffer}}),\quad \Delta_z=\mathrm{LAG}-\mathrm{BFE}
\]

## PDAL vs LAStools

| Dimension | **PDAL** | **LAStools** |
|-----------|----------|--------------|
| License | Fully open source (BSD-class) | Mixed: LASlib/LASzip open; many tools commercial / watermarked without license |
| Model | Declarative **JSON pipelines**; library + CLI | Many small CLI tools with rich flags |
| Formats | LAS/LAZ **and** many other point formats | Centered on LAS/LAZ efficiency |
| Integration | GDAL/PROJ, QGIS, Python | Fast Windows-centric batch; GUI wrappers exist |
| Ground filters | SMRF, PMF, CSF, ELM, outlier, … | `lasground` / `lasground_new` etc. (licensed tiers) |
| Speed | Generally solid; can be slower than hand-tuned LAStools | Often faster on large LAS/LAZ batches |
| TSM choice | **Default** for reproducible public-interest pipelines | Optional where a licensed workflow already exists; not required |

**libLAS** is legacy; PDAL replaced it for LAS 1.4+.

**Policy:** TSM seals PDAL pipeline JSON + source hash so any third party can replay LAG extraction without proprietary licenses.
