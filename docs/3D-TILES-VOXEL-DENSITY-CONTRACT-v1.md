# Voxel-Density Data Contract v1.0 (2026-10-18)

Formal specification for SDF voxel grids used by the TSM Transvoxel terrain pipeline.
This contract defines what a producer must supply and what a consumer may assume.

## 1. Grid Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dimensions` | uint32[3] | Yes | Voxel counts (nx, ny, nz) |
| `origin` | float64[3] | Yes | World coordinates of voxel (0,0,0) corner |
| `spacing` | float64[3] | Yes | Voxel size in meters (sx, sy, sz) |
| `crs` | string | Yes | CRS as WKT2 or EPSG code (e.g. `EPSG:3857`) |
| `vertical_datum` | string | Yes | e.g. `NAVD88`, `NGVD29`. Never assumed. |
| `coordinate_epoch` | float | No | Decimal year (e.g. `2020.5`). Required if CRS is time-dependent. |

## 2. Density Values

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `densities` | float32[nx·ny·nz] | Yes | Signed distance in meters. Negative = below surface, positive = above. |
| `nodata_value` | float32 | Yes | Sentinel for missing data (e.g. `-9999.0`). Consumer must skip these voxels. |
| `sdf_convention` | enum | Yes | `heightfield` (SDF = z − h(x,y), sign-correct, not Euclidean-exact on slopes) or `euclidean` (true distance transform). |

## 3. Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_dem` | string | Yes | Source DEM identifier + vintage (e.g. `usgs-3dep-1m-2017`) |
| `producer` | string | Yes | Software + version that generated the SDF |
| `created` | string | Yes | ISO 8601 timestamp |
| `sha256` | string | Yes | SHA-256 of the density array bytes |

## 4. Tiling

For grids larger than 128³, data MUST be tiled:
- Tile size: 64³ or 128³ voxels (producer's choice, declared in metadata)
- Tiles indexed by (tx, ty, tz) in a manifest JSON
- Each tile is an independent file conforming to §1–3
- Overlapping border of 1 voxel on each side for stitching

## 5. Octree LOD Structure

When an octree is built over the grid:
- Each LOD level halves the resolution (standard 2:1)
- Neighboring leaves MUST differ by at most 1 LOD level (2:1 balanced)
- Node metadata: `{level, bounds, min_density, max_density, child_mask}`
- The LOD scheduler (see `lod-scheduler.ts`) consumes this structure

## 6. Conformance

A producer conforms if it emits all Required fields with correct types.
A consumer conforms if it validates Required fields before use and handles
`nodata_value` voxels by exclusion (never interpolation across nodata).

## Version History
- v1.0 (2026-10-18): Initial contract.
