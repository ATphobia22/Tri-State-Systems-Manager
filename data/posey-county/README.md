# Posey County, Indiana — offline data bundle

Reference data vendored into the repo so the console, flood simulator, and
evidence tooling work offline. Everything here is public data; see per-file
sources below. Nothing in this bundle is survey evidence — it is
**reference only** (three-separate-truths doctrine: visualization and
computation here never silently become authoritative evidence).

## Contents

| Path | Description | Source | Vintage | License |
|---|---|---|---|---|
| `boundaries/posey-county.geojson` | Posey County boundary, full TIGER resolution (SHA-256 `10608bde…0a`) | U.S. Census Bureau, TIGER/Line 2023 counties (national file filtered to GEOID 18129) | 2023 | Public domain |
| `boundaries/posey-county.{shp,shx,dbf}` | Same boundary as ESRI shapefile | U.S. Census Bureau, TIGER/Line 2023 | 2023 | Public domain |
| `roads/tl_2023_18129_roads.zip` | All roads: I-64, state highways, ~712 mi county roads (SHA-256 `437f1f8b…6a`) | U.S. Census Bureau, TIGER/Line 2023 All Roads, Posey County IN | 2023 | Public domain |
| `elevation/` | DEM / lidar tiles for Posey County | USGS 3DEP 1/3 arc-second (10 m), NAVD88 — see below | 2022–2026 | Public domain |
| `floodplain/` | FEMA flood hazard layers for Posey County | Indiana DNR Best Available Flood Hazard Layer (gisdata.in.gov) | current | Public data |

## Floodplain

Queried 2026-09-27 from Indiana DNR's Best Available Flood Hazard Layer
(`https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/438`,
spatial filter on the Posey County bbox), EPSG:4326. Raw pull: 8,422 polygons
(zones A/AE/X). Vendored file keeps **SFHA only** (zones A + AE, 5,606 polygons),
coordinates rounded to 5 decimals, `-9999` BFEs nulled, garbled datum codes
nulled. Zone X (minimal flood hazard, 2,816 polygons) excluded for size.

| File | Description | SHA-256 |
|---|---|---|
| `floodplain/posey-flood-hazard-sfha.geojson` | 5,606 SFHA polygons, 24.6 MB; fields: fld_zone, zone_subty, sfha, bfe_ft, v_datum, depth_ft, study_typ, dfirm_id | `19f4a08e…f7eff` |

Anchor check: 13101 Bonebank Rd falls in zone **AE**, SFHA = T. The layer's AE
polygon there carries no static BFE — the case BFE 375.0 ft NAVD88 comes from
FIRM panel 18129C0265C / the FEMA letter, not this layer. Reference only.
| `parcels/` | Parcel boundaries | Indiana GIO, Parcel Boundaries of Indiana 2025 (Hosted FeatureServer) | 2025 | Public data, county-sourced |

## Parcels

Queried 2026-09-27 from the Indiana Geographic Information Office
`Parcel_Boundaries_of_Indiana_2025` FeatureServer
(`https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0`,
`where=county_fips='18129'`), paged in 2,000-record batches, EPSG:4326.

| File | Description | SHA-256 |
|---|---|---|
| `parcels/posey-parcels-2025.geojson` | 20,448 parcels, 17.8 MB; lean fields: parcel_id, state_parcel_id, prop_add/city/zip, DLGF class code, township | `fc936aa8…a87b9a8887` |

Anchor parcel present: **13101 BONEBANK RD**, parcel `65-19-08-100-008.001-010`,
DLGF class 511, POINT TOWNSHIP.

## Elevation

Built 2026-09-27 from four USGS 3DEP 1/3 arc-second tiles
(`n38w088`, `n38w089` vintage 2026-04-17; `n39w088`, `n39w089` vintage
2022-12-05) read windowed over HTTPS from `prd-tnm.s3.amazonaws.com`,
mosaicked, and clipped to lon −88.10…−87.45, lat 37.70…38.38 (51.6 M cells,
zero voids). Units: meters, NAVD88, EPSG:4269.

| File | Description | SHA-256 |
|---|---|---|
| `elevation/posey-county-dem-30m.tif` | County DEM downsampled ×3 (≈30 m), LZW float32, 19.6 MB; range 99.9–188.3 m | `eada1ff5…222a8d31f` |
| `elevation/bonebank-anchor-dem-10m.tif` | Full 10 m window ±0.03° around 13101 Bonebank Rd (37.845887, −88.005075), 1.3 MB; range 101.1–115.1 m (331.6–377.7 ft — brackets the case LAG 377.2 ft) | `2a6c85df…5bef925f` |
| `elevation/sources.txt` | Exact source tile URLs | — |

County-wide 1 m DEM was intentionally **not** vendored (≈1–2 GB); the 30 m
county grid plus the 10 m anchor window cover screening and site work.
Reference only — not survey evidence.

## Pending downloads

Elevation (IndianaMap DEM tile footprints, IGIC county-wide lidar/DEM tiles,
IU ISDP 2016–2020 elevation, OpenTopography), FEMA NFHL flood layers, and
parcel data are being sourced from:

- https://indianamap-inmap.hub.arcgis.com/maps/INMap::indiana-dem-tile-footprints/about
- https://www.igic.org/countywide-lidar-and-dem-tiles
- https://gis.iu.edu/s/isdp/page/20162020elevation
- https://portal.opentopography.org/datasets (TIN / ALS searches)
- https://poseyin.wthgis.com/ (county GIS portal — interactive)
- https://engage.xsoftinc.com/posey/AdvancedSearch (assessor search — interactive)

Large rasters (county-wide 1 m DEM ≈ 1–2 GB) will **not** be vendored whole;
the bundle will carry a downsampled county DEM plus full-resolution tiles
around the 13101 Bonebank Rd anchor site, with provenance and hashes recorded
here.

## Notes

- `posey-county.geojson` properties carry the full Census record
  (GEOID `18129`, STATEFP `18`, NAMELSAD `Posey County`).
- Roads zip verified intact (`testzip` clean), kept zipped: 630 KB.
- Coordinate reference: NAD83 (EPSG:4269) as published by the Census Bureau.
