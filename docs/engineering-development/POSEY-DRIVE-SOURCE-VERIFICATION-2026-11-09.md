# Posey County Drive source verification — 2026-11-09

This note records a local, read-only inspection of the **actual raw files** recovered from the user's Google Drive. Source data remains outside Git. The evidence does **not** certify heights, engineering elevations, survey accuracy, or a packaged release.

## Footprint identity and geometry

| Inspection | Official IGIO footprints | Derived building attributes |
|---|---:|---:|
| File | `posey-igio-buildings.geojson` | `buildings-3d.geojson` |
| SHA-256 | `172c2568864b6c012dc1fdebab245e25d64d23582d548a3c5a7b8eb09d8dec68` | `617a6116aaccac87354f0fa02285e322ec07c4e99ca9f0a14739f2c44f5cf881` |
| Features | 23,082 | 23,082 |
| Unique `objectid` | 23,082 | 23,082 |

All 23,082 `objectid` values are shared; **zero** left-only, right-only, or duplicate identities. All 23,082 corresponding GeoJSON geometry objects match exactly. This is an exact coordinate-array equality check, **not** a topological tolerance or CRS transformation. Official file has no root `crs` field; derived file declares `OGC:CRS84`.

Derived height-source categories: `DEFAULT_RURAL_MEDIAN` = 12,155; `OVERTURE_NEAREST_20M` = 10,927. These attributes are **not measured roof elevations** and do not prove LOD2/LOD3/LOD4 structure. All derived ground elevations have `elev_source=OPENTOPODATA_NED10M_GRID_0.01DEG`; vertical-datum evidence was not independently established.

## DEM raster inspection

| File | SHA-256 | Embedded horizontal CRS | Raster | Resolution |
|---|---|---|---|---|
| `IN2020_26700930_12.tiff` | `1a321bc386e0de8b7cca74ec903fb35ea8fb54e8cdd7e835428210562e173ebb` | EPSG:2968 | 2000×2000 | 2.5×2.5 native units |
| `IN2020_26850945_12.tiff` | `78f987ad4f93d3680d4500ad0b74542872f83529861b5500863addb61c00d124` | EPSG:2968 | 2000×2000 | 2.5×2.5 native units |

Both raw-file hashes matched the stored download receipt. EPSG:2968 is **NAD83(HARN) / Indiana West (ftUS)**, not the project's EPSG:2966 **NAD83 / Indiana West (ftUS)**. A vetted datum transformation is necessary when coupling these grids to project data. The TIFF bands supply no verified vertical-datum/vertical-unit metadata. No NAVD88 assertion or elevation conversion is authorized based on these TIFFs alone.

## Remaining gates

- Integrate a source-verification receipt into staged TSMData while keeping private raw datasets out of Git.
- Establish appropriate projected CRS handling and independently verify **vertical datum and units** using authoritative acquisition metadata.
- Validate measured-building heights and mesh topology independently.
- Verify Windows UE5.8 Shipping and the offline executable separately.
- Do not substitute this source inspection for survey or flood-regulatory certification.
