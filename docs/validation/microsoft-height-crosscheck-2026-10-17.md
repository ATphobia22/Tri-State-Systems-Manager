# Microsoft Building Height Cross-Validation — 2026-10-17

**Status:** Independent recount of Microsoft tile **verified** · Height Δ stats are **TSM sample results** · Overture **reachable** from open egress (blocked only on some restricted VMs)

## Microsoft tile (verified 2026-10-17)

| Field | Value |
|-------|--------|
| Source | [GlobalMLBuildingFootprints](https://github.com/microsoft/GlobalMLBuildingFootprints) 2026-08-13 refresh |
| Quadkey | `032000212` (UnitedStates) |
| Tile URL | `https://bfppub.z5.web.core.windows.net/2026-08-13/global-buildings.geojsonl/RegionName=UnitedStates/quadkey=032000212/...csv.gz` |
| Independent recount | **42,965** buildings · **24,583** with `height > 0` · **18,353** with `height = -1` |
| Approx tile bounds | lon −88.59…−87.89 · lat 37.72…38.27 (**larger than Posey County**) |
| License | CDLA Permissive 2.0 |

## Cross-check method (TSM sample)

- Sample: 1,000 random buildings from TSM `buildings-3d.json` (LiDAR/NDHM-derived heights)
- Match rule: nearest Microsoft centroid within ~**20 m**
- Matched pairs: **240 / 1,000 (24%)**
- Mean |Δh|: **1.47 m**
- Median |Δh|: **0.92 m**
- Within 2 m: **79.6%** (~80%)

## Why the match rate is only 24% (not a height-quality failure)

The 24% figure is a **spatial-join / inventory-overlap rate**, not “only 24% of heights are good.”

1. **Tile ≠ county**  
   Quadkey `032000212` covers Posey **plus** adjacent Indiana/Illinois/Kentucky fringe. Many MS buildings have no counterpart in a Posey-scoped TSM inventory, and some TSM features fall outside dense MS clusters.

2. **Different detectors**  
   Microsoft footprints are **ML from satellite/aerial imagery**. TSM heights ride on **LiDAR/NDHM + local footprint sources** (e.g. IGIO-derived). One source may split a farm complex; the other may merge sheds; barns and outbuildings appear in one set more than the other.

3. **20 m nearest-centroid gate**  
   A strict distance threshold rejects pairs whose footprints disagree (offset centroid, large rural footprint, partial footprint). Raising the threshold increases match rate but risks wrong-building matches.

4. **Height availability filter**  
   Only ~57% of MS buildings in this tile carry a positive height (`24,583 / 42,965`). Matches still require a TSM height and a successful spatial pair.

5. **Temporal and definition mismatch**  
   Imagery vintage vs LiDAR flight year, “building” vs accessory structure definitions, and demolished/new construction all reduce 1:1 pairing without implying that matched heights are noise.

**Interpretation:** On the **matched subset**, median agreement ~1 m is consistent with independent literature comparing lidar-derived heights to imagery/ML heights (often MAE ~1–3 m). Unmatched buildings do **not** prove either catalog is wrong—they prove the catalogs are **not the same inventory**.

## LiDAR vs satellite / ML height accuracy

Typical published ranges (order-of-magnitude; study-dependent):

| Method | Typical building-height error | Notes |
|--------|-------------------------------|--------|
| **Airborne LiDAR** (e.g. USGS 3DEP class) | **~0.05–0.3 m** vertical sensor class; building-from-points often **~0.5–2 m MAE** vs other lidar products after roof/ground extraction | Direct range measurement; penetrates vegetation better; gold standard for open elevation products |
| **Aerial photogrammetry** | **~0.3–0.5 m** building height RMSE under good control | Needs texture/light; weaker under canopy |
| **Satellite stereo / optical AI** | **~1–3 m** building height RMSE common | Global coverage; sensitive to occlusion, stereo quality, temporal offset |
| **Microsoft-style ML heights** (imagery + NN) | Literature vs lidar often **~1–2+ m MAE**; underestimation bias reported for complex roofs | Designed for scale, not survey certificates |

USGS-style comparisons (3DEP lidar vs Microsoft Global Building Footprints heights) report weaker correlation for GBF (e.g. R² ~0.5–0.6, MAE ~2.5–3.1 m in published site studies) than lidar-vs-lidar products—exactly the class of disagreement TSM is measuring. **TSM’s 0.92 m median on matched pairs is therefore a strong regional agreement signal for screening**, not a claim of survey accuracy.

### Authority class for TSM

| Product | Authority |
|---------|-----------|
| TSM LiDAR/NDHM building heights | **DERIVED** (scientific plane) |
| Microsoft ML heights | **DERIVED** / independent open ML |
| FEMA / surveyed structure height | **REGULATORY / survey** only with documented sources |
| Twin Canvas extrusions using these heights | **SIMULATION_DEMO / screening** until human-authorized evidence gates pass |

## Overture Maps accessibility (verified 2026-10-17)

| Check | Result |
|-------|--------|
| `https://overturemaps-us-west-2.s3.amazonaws.com/` | **HTTP 200** |
| List `release/` | **200** — prefixes include `2026-08-19.0/`, `2026-09-23.0/`, `2026-09-23.1/` |
| List buildings theme | **200** — GeoParquet parts ~500 MB each under `release/2026-09-23.1/theme=buildings/type=building/` |
| Azure folder `overturemapswestus2.blob.core.windows.net/release/2026-09-23.1/...` | **HTTP 200** |
| Full regional clip via `pip install overturemaps` | **Failed in this sandbox** (PyPI proxy 502) — **not** an Overture S3 outage |
| Restricted VM / corporate SSL inspection | May still fail handshake — environment-specific |

**Conclusion:** Overture is **publicly available**. Prior “blocked” reports from a restricted VM are **egress/proxy failures**, not missing data. Microsoft tile validation remains the lightest independent height check for Posey until a local Overture bbox extract is run (CLI on a host with working PyPI + DuckDB/httpfs, or Athena).

Official paths:

- S3: `s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/type=building/*`
- Docs: https://docs.overturemaps.org/guides/buildings/

Overture buildings merge OSM (priority) + Microsoft + Google Open Buildings + other sources; `height` is optional meters above ground.

## Provenance

- Microsoft data downloaded and recounted: 2026-10-17
- Overture S3/Azure probes: 2026-10-17
- Height Δ statistics: original TSM ad-hoc sample (shapely, numpy) — not re-run in this verification pass
- Human authority remains final; screening validation only
