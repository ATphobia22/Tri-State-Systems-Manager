# LiDAR classification, ground filtering, and hydro treatments

Status: **reference documentation — verified facts with sources, plus what the
repo implements and what it deliberately does not** (2026-11-07).

Every factual claim below was verified by web search against the cited
authoritative source on 2026-11-07; per-claim verdicts live in
`~/workspace/goals/tri-state-systems-manager-repo-fixes/hidden_files/lidar-verification-2026-11-07.md`
(working copy; the in-repo record is this file). Where a pasted note was
wrong, the correction is stated here and the wrong value is not repeated
except to name the error.

## The one correction that matters most

A pasted EPQS note stated the regulatory BFE as **375.0 ft**. That is the old,
superseded working target. The verified regulatory BFE is **369.1 ft NAVD88**
(FEMA FIS 18129CV000A Table 9 §A, Indiana DNR cross-sections, FIRMette).
Owner-claimed LAG 377.2 ft = **+8.1 ft** above BFE. Never write 375.0 as the
BFE. The EPQS site value (~364 ft) is an interpolated terrain sample, ~5 ft
below BFE and ~13 ft below the claimed LAG; the 13.2 ft DEM-vs-LAG delta
remains UNRECONCILED.

## ASPRS / USGS class codes

Verified against USGS LBS Table 5 (2025 rev. A) and the ASPRS LAS 1.1–1.4
table. Wording differs for two codes: ASPRS says class 1 "Unassigned" and
class 7 "Low Point"; the LBS says class 1 "Processed, but unclassified" and
class 7 "Low noise". Both labels are legitimate; neither is an error.

| Code | Meaning |
|---|---|
| 0 | Created, never classified |
| 1 | Unassigned / Processed, but unclassified |
| 2 | Ground / Bare earth — the only class a bare-earth DEM is built from |
| 3 | Low Vegetation |
| 4 | Medium Vegetation |
| 5 | High Vegetation |
| 6 | Building |
| 7 | Low Point / Low noise |
| 9 | Water |
| 17 | Bridge Deck |
| 18 | High Noise |
| 20 | Ignored Ground (typically breakline proximity) |

In LAS 1.4, codes 8 and 12 are reserved (use class flags instead);
LAS 1.1–1.3 support only 0–31. Code implemented in TypeScript:
`packages/geo/src/lidar/LidarClasses.ts`.

Sources:
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables
- https://pro.arcgis.com/en/pro-app/3.0/help/data/las-dataset/storing-lidar-data.htm

## Quality levels (QL0–QL3)

Lidar QL requirements, USGS LBS Table 4 (2025 rev. A) and the USGS QL page.
Terminology: LBS 2024 rev. A renamed `RMSEz` to `RMSEv` under ASPRS
Positional Accuracy Standards Ed. 2; values unchanged.

| Level | RMSEv non-veg | NVA 95% | VVA | Max NPS | Min NPD | DEM cell |
|---|---|---|---|---|---|---|
| QL0 | ≤ 0.050 m | 0.098 m | 0.15 m | ≤ 0.35 m | ≥ 8 pts/m² | 0.5 m |
| QL1 | ≤ 0.100 m | 0.196 m | 0.30 m | ≤ 0.35 m | ≥ 8 pts/m² | 0.5 m |
| QL2 | ≤ 0.100 m | 0.196 m | 0.30 m | ≤ 0.71 m | ≥ 2 pts/m² | 1 m |
| QL3 | ≤ 0.200 m | 0.392 m | 0.60 m | ≤ 1.41 m | ≥ 0.5 pts/m² | 2 m |

QL0 and QL1 share pulse density and differ only in accuracy. QL4 (imagery)
and QL5 (IfSAR) are not lidar levels. These are **dataset QA metrics**, not
per-point filters: a QL2 collection (Posey County 2020) was specified to
10 cm non-vegetated RMSEv at ≥ 2 pulses/m² — that certifies no single point
or pixel. Implemented in TypeScript: `packages/geo/src/lidar/QualityLevel.ts`
(unknown levels return null, never a guess).

Sources:
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables
- https://www.usgs.gov/3d-elevation-program/topographic-data-quality-levels-qls
- https://www.usgs.gov/ngp-standards-and-specifications/adopt-updated-accuracy-standards

## EPQS and the 3DEP dynamic elevation service

- EPQS returns elevations **interpolated** from the 3DEP dynamic elevation
  service (a web coverage service). It does **not** return a surveyed ground
  mark. The same dataset backs the Bulk Point Query Service and the National
  Map Spot Elevation widget, with the same accuracy.
- Resolution stack (best available first): 1 m lidar-based DEMs where
  available, then the 1/3 arc-second (~10 m) seamless DEM. **There is no
  live 1/9 arc-second tier in the current EPQS stack** — 1/9 arc-second
  seamless DEMs are discontinued, and the EPQS FAQ lists no 1/9 tier.
- **Bilinear interpolation is NOT verified for EPQS.** USGS says only
  "interpolated". Do not assert bilinear for EPQS without a WCS-service
  source. (Bilinear is standard raster practice and is documented for
  seamless DEM post derivation, but the EPQS-specific claim is unverified.)
- Accuracy (USGS FAQs, verified): dynamic elevation service **RMSE 0.53 m**
  (~1.7 ft); 1/3 arc-second seamless DEM **~0.82 m RMSE** as of 2022,
  "based on a comparison to almost 25,000 NOAA National Geodetic Survey
  OPUS points", improved from **1.55 m tested in 2013** as lidar was added.
  Local error is much larger on steep slopes, dense canopy residuals, and
  older non-lidar sources. These are network tests, not a per-pixel
  guarantee.
- NSSDA 95% bounds (FGDC-STD-007.3, Accuracy_z = 1.9600 × RMSE_z): **±1.04 m**
  for the dynamic service, **±1.61 m** for the 1/3 arc-second seamless DEM.
  These are dataset accuracy statistics under NSSDA assumptions — engineering
  screening bounds only, not a FEMA determination or survey certification,
  and never a per-lot-corner elevation.
- Datum: 3DEP bare-earth products for CONUS are referenced to NAVD88.
  Recent seamless 1 m work uses GEOID18; older projects used earlier geoids
  — the 2020 Indiana collection carries Geoid12B. Always read the product
  metadata for the specific tile; never silently mix geoids.
- EPQS clients already in the repo: `backend/geospatial/posey/parcel_flood_join.py`
  (`epqs_elevation`) and `tsm-console/server/ingestion/posey-spatial-chain.mjs`.
  There is no shared TypeScript EPQS client in `packages/*`.

Sources:
- https://www.usgs.gov/faqs/how-accurate-are-elevations-generated-elevation-point-query-service-national-map
- https://www.usgs.gov/faqs/what-vertical-accuracy-3d-elevation-program-3dep-dems

## Ground-filter families

Primary sources, all verified to exist:

| Family | Source |
|---|---|
| Progressive TIN densification (PTD) | Axelsson, P., 2000. "DEM generation from laser scanner data using adaptive TIN models." *Int. Archives of Photogrammetry and Remote Sensing*, XXXIII(B4/B3). |
| Progressive morphological filter (PMF) | Zhang, K. et al., 2003. "A progressive morphological filter for removing nonground measurements from airborne LIDAR data." *IEEE Trans. Geoscience and Remote Sensing*, 41(4), 872–882. DOI 10.1109/TGRS.2003.810682. |
| Simple morphological filter (SMRF) | Pingel, T.J., Clarke, K.C. & McBride, W.A., 2013. "An improved simple morphological filter for the terrain classification of airborne LIDAR data." *ISPRS J. Photogrammetry and Remote Sensing*, 77, 21–30. Implemented in PDAL as `filters.smrf`. |
| Cloth simulation filter (CSF) | Zhang, W. et al., 2016. "An Easy-to-Use Airborne LiDAR Data Filtering Method Based on Cloth Simulation." *Remote Sensing*, 8(6), 501. |
| Multiscale curvature classification (MCC) | Evans, J.S. & Hudak, A.T., 2007. "A multiscale curvature algorithm for classifying discrete return LiDAR in forested environments." *IEEE Trans. Geoscience and Remote Sensing*, 45(4), 1029–1038. |

Error framing (Sithole & Vosselman 2004): Type I error = ground points
misclassified as non-ground; Type II error = non-ground points
misclassified as ground. The consequences — Type I omission leaves holes
in the DEM, Type II commission leaves bumps — follow from those definitions
and are an explanatory gloss, not a quotation. Steep slopes and dense low
vegetation stress all filters.

PDAL notes (verified): `filters.smrf` parameters are cell (default 1.0),
ignore, scalar (default 1.25), slope (default 0.15), threshold (default 0.5),
window (default 18.0) — https://pdal.io/en/2.6.3/stages/filters.smrf.html.
PDAL's `filters.pmf` doc advises preferring SMRF over PMF in most cases.
PDAL pipeline files are JSON; PDAL ≥ 2.4.0 supports comments in pipeline
JSON, but the `#` form specifically is unconfirmed and strict JSON has no
comment syntax — write pipeline JSON comment-free to be safe across
versions. The repo's builders (`scripts/geospatial/pdal_pipelines.py`)
already do this.

## Vegetation height-above-ground bands — corrected

The USGS LBS defines **no heights** for classes 3/4/5. The bands are a
project convention and vary by project. The bands in the pasted educational
sketch (<0.5 m low, <2.0 m medium, else high) are **wrong in both cut
points** and must not be used:

| Convention | Low | Medium | High |
|---|---|---|---|
| Most common metric (project metadata) | 0.5–2 m | 2–6 m | 6+ m |
| Imperial (USGS project reports) | 0.5–5 ft | 5–20 ft | >20 ft |
| Third metric variant | 0.5–2 m | 2–5 m | >5 m |

Low vegetation **starts at 0.5 m**; points below that are near-ground
returns, not low vegetation. The TypeScript helper
(`packages/geo/src/lidar/PointClassification.ts`, `classifyVegetationByHag`)
takes bands as explicit parameters defaulting to the most common metric
convention (0.5–2 / 2–6 / 6+ m), leaves points below 0.5 m HAG and points
with unknown ground elevation unchanged, and never mutates its inputs.

## Hydroflattening, enforcement, conditioning

Per USGS LBS 2025 rev. A, "DEM Surface Treatments":

- Waterbodies with a surface area of **0.8 ha (2 acres) or greater** shall be
  flattened; a flattened waterbody presents a flat and level water surface
  (a single elevation for every bank vertex of its perimeter).
- Streams and rivers of **30 m or greater nominal width** shall be
  flattened; flattened rivers present a flat and level water surface
  bank-to-bank and a gradient downhill, following the surrounding terrain.
- Bare-earth points in close proximity to any breakline shall be classified
  as Ignored Ground (class 20) and excluded from DEM generation. The
  proximity threshold is at the producer's discretion and **in general
  should not exceed twice the ANPS** — an upper bound, not a fixed buffer.
- Stream channels break at culverts (roadway intact) but are continuous at
  bridges; bridges are removed from the DEM; islands ≥ 0.4 ha (1 acre) are
  delineated.

The three treatments are different products:

| Treatment | Purpose | Water behaviour |
|---|---|---|
| Hydro-flattened | Cartographic bare-earth DEM | Flat / bank-level / downhill |
| Hydro-enforced | Drainage connectivity for flow models | May cut barriers (culverts) |
| Hydro-conditioned | Flow routing (fill sinks, breach barriers) | Every cell flows to a stream and outlet |

A hydro-flattened DEM "carries ZERO implicit or explicit accuracy with
regards to the represented water surface elevations — it is ONLY a
cartographic/aesthetic enhancement". Flattened water elevations are
estimated from adjacent terrain and must not be used for water volume,
flow, or H&H modelling. Hydroflattening changes the DEM, never the
original point-cloud geometry. Constraint builders and thresholds:
`packages/geo/src/lidar/HydroTreatment.ts`.

Source:
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-digital-elevation-model-surface

## TSM rules (standing)

- Filtering / classification output is **DERIVED terrain**. A hydro-flattened
  DEM is mapping / twin terrain only. A hydro-enforced surface is a model
  input only, with explicit provenance. Neither is a regulatory water
  surface — the FEMA BFE (369.1 ft NAVD88) is the regulatory authority, not
  the DEM. EPQS / 3DEP samples are terrain screening only; never use them to
  disprove a BFE or claim a LOMA outcome.
- Missing data stays UNAVAILABLE, never fabricated. A treatment label must
  reflect what was actually done — a pipeline that builds no DEM must not
  report `hydro_flattened`.
- River values come only from a user-initiated snapshot; nothing in this
  area adds polling or background refresh.

## What the repo has, and what it deliberately does not

Already exists — do not rebuild:
- PDAL SMRF ground classification, DEM rasterisation, and HAG building
  tagging: `scripts/geospatial/pdal_pipelines.py` (builders work without
  PDAL installed; `run_pipeline` shells to `pdal pipeline`; PDAL ≥ 2.5
  required to execute). Pre-built pipelines in `tsm-console/pipelines/pdal/`.
  Tests: `scripts/geospatial/test_pdal_pipelines.py`.
- Class 2/6 height extraction and COPC DERIVED heights:
  `scripts/geospatial/extract_lidar_heights.py`,
  `scripts/geospatial/extract_derived_heights_copc.py`.
- EPQS point queries: `backend/geospatial/posey/parcel_flood_join.py`,
  `tsm-console/server/ingestion/posey-spatial-chain.mjs`.
- 3DEP/EPT registry: `scripts/flood-forecasting/tsm_usgs_lidar_ept.py`.
- Classification policy and filter comparison docs:
  `docs/PDAL-CLASSIFICATION-LOGIC.md`, `docs/SMRF-AND-PDAL-VS-LASTOOLS.md`,
  `tsm-console/docs/1D-2D-COUPLING-AND-LIDAR-FILTERING.md`.
- TypeScript lidar utilities (new 2026-11-07):
  `packages/geo/src/lidar/` — class constants, QL model, ignored-ground
  marking, HAG vegetation banding, hydro constraint builders.
  Tests: `tests/contracts/lidar-classification.test.ts`.

Deliberately NOT implemented (recorded gaps, not oversights):
- No progressive TIN densification, PMF, CSF, or MCC implementation
  anywhere in the repo. A real PTD filter needs a genuine Delaunay TIN
  implementation and validation against real data (Posey 2020 QL2 COPC);
  writing a stub that seeds lowest-per-cell points and demotes the rest
  would destroy ground classification and is prohibited. This is a future
  epic, not a paste adoption.
- No hydroflattening / enforcement / conditioning execution and no breakline
  extraction from lidar/DEM — only the constraint builders above and the
  `hydro_enforced` boolean flag in the HEC-RAS contract (asserted, never
  computed).
- No vegetation class 3/4/5 separation in the Python pipelines (the HAG
  pipeline lumps tall points into class 6 with a `filters.planefit`
  refinement step that does not exist yet) and no shared TypeScript EPQS
  client in `packages/*`.
- No tests for `extract_lidar_heights.py` (requires laspy, not installed on
  this VM); no PDAL execution here (PDAL is not installed on this VM).
