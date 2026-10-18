# Geospatial Fabric Index

**Review date:** 2026-10-18
**Scope:** Every geospatial dataset in the TSM repository — location, format, CRS, vintage, and provenance.

Missing data stays missing: entries marked unavailable are not placeholders. Authority classes (OBSERVED, DERIVED, REGULATORY, SCENARIO) are never mixed.

---

## 1. Buildings (22,815 features)

| Attribute | Value |
|---|---|
| Console asset | `tsm-console/public/3d-tiles/buildings-3d.json` |
| Format | GeoJSON (feature store); GLB 3D Tiles 1.1 (render) |
| CRS | EPSG:4326 (GeoJSON); EPSG:3857 (GLB vertex space) |
| Count | 22,815 features — all 22,815 have heights |
| Height provenance | 11,624 OBSERVED · 10,008 Purdue Digital Forestry NDHM 2017–2019 (footprint-median zonal, method `ndhm-footprint-median`) · 1,183 DERIVED (202 dem-30m-sample relabeled 2026-10-17) |
| LOD | 7,453 `achievedLod = 2` (roof planes) · 15,362 LOD1 · 0 nulls |
| LOD2 PoC | `scripts/geospatial/lod2-proof-of-concept.py` — 29/30 buildings, 100% watertight (validated 2026-10-18; scale-up to all 7,453 not done) |
| Cross-validation | Microsoft Global ML footprints: mean abs diff 1.47 m, median 0.92 m, 79.6% within 2 m (`docs/validation/microsoft-height-crosscheck-2026-10-17.md`) |
| GLB tree | `tsm-console/public/3d-tiles/buildings/` (~39 MB, Draco-compressed per `a3510502`) |

## 2. Terrain / DEM

| Dataset | Location | Format / CRS | Vintage | Provenance |
|---|---|---|---|---|
| USGS 3DEP 1 m | `data/fabrics/downloads/usgs-3dep-1m/` (5 × 50 MB chunks + `reassemble.sh`, MD5-verified) | GeoTIFF · EPSG:26916 · NAVD88/GEOID12B · meters | 2017 B17 QL2 (Woolpert) | USGS National Map, STAC; tile `USGS_1M_16_x41y419_IN` |
| Indiana 2020 DEM | `data/fabrics/downloads/indiana-dem-2020/posey-dem-2020-2k.tif` (17 MB) | GeoTIFF · EPSG:2968 · NAVD88/GEOID12B · 2.5 ft bare-earth hydro-flattened | Spring 2020 | Indiana GIO `giselevationingov` S3 |
| Terrain 3D Tiles | `tsm-console/public/3d-tiles/terrain-3dep/` (28 GLBs, SHA-256 verified 2026-10-17) | glTF 2.0 / 3D Tiles 1.1 | Derived from above | `scripts/geospatial/dem_to_transvoxel.py` bridge |

## 3. 3D Tiles Fabric

| Attribute | Value |
|---|---|
| Tileset manifest | `tsm-console/public/3d-tiles/tileset.json` |
| Structure | Implicit quadtree, 479 valid GLBs, pure-geometry (no per-feature IDs; linkage via source GeoJSON) |
| Linkage validation | `scripts/geospatial/validate_feature_linkage.py` — PASS (fixed 2026-10-17: implicit template URI `content/{level}/{x}/{y}.glb`) |
| Authority boundary | PASS — 22,815 source OBJECTIDs, no simulated leakage |

## 4. Parcels

| Dataset | Location | Format / CRS | Vintage | Provenance |
|---|---|---|---|---|
| Posey County IN | `data/posey-county/parcels/posey-parcels-2025.geojson` | GeoJSON · EPSG:4326 | 2025 | Indiana parcel layer; anchor parcel APN `65-19-08-100-008.001-010` (state ID 651908100008001010) verified 2026-10-17 |
| White County IL | repo bundle (owner names stripped) | GeoJSON | 2026-10-01 acquisition | County source |
| Henderson County KY | repo bundle (owner names stripped) | GeoJSON | 2026-10-01 acquisition | County source |
| Union County KY | **MISSING** — requires PVA contact (Clay Wells, (270) 389-1933); no contact authorized | — | — | — |

## 5. Roads (TIGER 2024)

| Attribute | Value |
|---|---|
| Location | `data/fabrics/downloads/tiger-2024/` |
| Coverage | All 8 tri-state counties (GEOIDs 18129, 18163, 18051, 18173, 17059, 17193, 21101, 21225) + `tl_2024_us_county.zip` (81 MB) |
| Layers | Roads + linear water per county |
| Provenance | U.S. Census Bureau TIGER/Line 2024, public download |

## 6. LiDAR / Point Clouds

| Dataset | Location / Access | Format / CRS | Vintage | Provenance |
|---|---|---|---|---|
| USGS 3DEP EPT | `scripts/flood-forecasting/tsm_usgs_lidar_ept.py` (config + `--check`) | EPT via `https://s3-us-west-2.amazonaws.com/usgs-lidar-public/` | Project `IN_2020` | USGS 3DEP |
| LiDAR LODs (console) | `tsm-console/public/3d-tiles/buildings-lidar-12450/` (~27 MB) | 3D Tiles | Derived | Asset tree committed 2026-10-18 |
| Indiana LiDAR | S3 `giselevationingov` (HTTPS REST; AWS CLI blocked by proxy) | Tile grid = Indiana State Plane West feet / 1000 | 1970–2025 | Indiana GIO, CC0 |
| Kentucky DEM | S3 `kyfromabove` Phase 2 2 ft DEM (Henderson + Union Co tiles) | — | Phase 2 | KyFromAbove |
| Illinois elevation | USGS 3DEP S3 `prd-tnm` (Gallatin Co n37w089) | — | — | USGS |

## 7. Imagery

| Dataset | Access | Coverage | Provenance |
|---|---|---|---|
| Indiana imagery 1970–2023 | S3 `gisimageryingov` (HTTPS) | Recent (2018+) covers northern/central tiers; Posey (southwest) earlier-vintage only | Indiana GIO, CC0 |
| Indiana 2025 leaf-on 6-inch | S3 `gisimageryleafoningov` | 2025 | Indiana GIO, CC0 |
| IndianaMap | ArcGIS REST (configured non-default layer) | Indiana | Indiana GIO |
| Basemap (default) | OpenFreeMap vector tiles | Global | OpenMapTiles |

## 8. Reference / Derived Geospatial

| Dataset | Location | Notes |
|---|---|---|
| GEOID18 | `data/geo/geoid18/g2018u0.bin` (33 MB) + `README.md` | Anchor lookup −30.302 m validated 2026-10-15; scope NAD83(2011)↔NAVD88 |
| Overture buildings | `data/overture/` | Release 2026-09-23.1; 24,375 buildings, 18,302 with height>0, median 3.666 m; DERIVED/screening authority only (ODbL) |
| USACE NLD | `data/fabrics/downloads/nld/` | 104 leveed areas (incl. Posey County Levee Unit No. 5), 718 embankments, 934 floodwalls, 104 system routes |
| IDNR floodplain | `data/fabrics/downloads/idnr-floodplain/Posey-floodplain.zip` (75 MB) | Best Available Floodplain — STATE product, never presented as FEMA |
| CSLF preliminary | `data/fabrics/downloads/cslf/posey-cslf-feb2025.geojson` (4,131 features) | Preliminary Feb 2025 — NOT effective FEMA |
| Critical facilities | `data/fabrics/critical-facilities/` | NERIS Public: 15 fire stations, 14 fire departments; HIFLD hospitals verified 0 in Posey |
| Hydraulic models | `data/fabrics/hydraulic-models/` | Ohio River (4449 CANDIDATE_ARCHIVE_ONLY — NGVD29 confirmed, execution NOT granted) + McFadden Creek (9917, 9928, 6149, 1738, 653) |
| TESSERA embeddings | `~/workspace/tessera-tristate/tessera_2025_anchor_20km.npy` (2.0 GB, NOT in git) | 2025, 20×20 km anchor window, 100% valid, UTM 16N; CC-BY-SA |
| OGC tile manifest | `artifacts/tsm-geospatial-tile-fabric-v1.json` (schema 1.1.0) | 15 assets, unique IDs, per-asset CRS + vertical-datum policy + verification record |
| Live hydrology registry | `data/fabrics/live/tsm-live-hydrology-fabric-v1.json` | NOAA_NWPS + NOAA_NWM **retired** (owner decision 2026-09-29); USACE_NLD + USGS_3DEP active |

---

## Cross-Fabric Contract Status (2026-10-18)

Contracts from PR #288 (merged): `tsm-console/tests/cross-fabric-contract.test.ts` — **6/6 PASSING** (verified 2026-10-18).

Covered by tests:
1. Map-plane ↔ structural-pipeline registry 1:1 alignment (unique IDs + indexes)
2. Stable default-visible layer IDs: `indiana-parcels`, `indiana-roads`, `posey-cslf`, `terrain-rgb`, `usgs-3dep-elevation`
3. No non-renderable default-visible layers
4. Data-fabric registry: unique IDs, sources, outputs, implemented/live/persistence flags
5. Tile manifest: unique asset IDs, FEMA-effective vs Indiana-BAFM kept as separate authority classes, per-asset HTTPS source URL + CRS + vertical-datum policy + verification state/timestamp
6. Retired live-hydrology sources carry explicit retirement reasons

Open reconciliation gate (`docs/fabrics/CROSS-FABRIC-READINESS-2026-10-18.md`): the registry retires NOAA live river sources, but other registry/tile-manifest/runtime files and docs still describe live river products. Until reconciled, TSM must not claim live hydrology is uniformly enabled, disabled, or production-healthy.
