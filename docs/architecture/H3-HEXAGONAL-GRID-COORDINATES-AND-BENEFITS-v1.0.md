# H3 Hexagonal Grid — Benefits, Coordinate Systems, and TSM Engineering

**Version:** 1.0.0  
**Date:** 2026-10-24  
**Spec:** [H3](https://h3geo.org) / [uber/h3](https://github.com/uber/h3)  
**Code:** `packages/geo/src/h3/coordinates.ts`

---

## 1. Why hexagons (benefits)

| Benefit | Explanation |
|---------|-------------|
| **Uniform neighbors** | Every hex has **6 equidistant neighbors**. Squares have 4 orthogonal + 4 diagonal at √2 distance — anisotropic neighborhoods bias distance and flow analysis. |
| **Better area isotropy** | For a given resolution, hex cells are **approximately equal area** worldwide (aside from 12 pentagons). Lat/lon rectangles shrink toward the poles. |
| **Hierarchy** | Aperture-7 subdivision: each parent splits into **7** children; edge scales ≈ √7. Enables roll-up (site → corridor → county) without remeshing. |
| **Compact rings** | k-ring / gridDisk algorithms are simple; disk size = `3k(k+1)+1`. |
| **Stable IDs** | 64-bit cell IDs are stable primary keys for evidence, parcels, gage vicinity — preferred over volatile UE World Partition cell names. |
| **Analytics** | Ideal for aggregation (flood exposure counts, stage samples per cell, H3-indexed OSM loads via openstreetmap_h3). |

### Global construction (brief)

1. Sphere circumscribed **icosahedron** (Dymaxion orientation).  
2. Hex grid on each planar face; **gnomonic** projection to the sphere.  
3. **122 base cells** at resolution 0 (110 hex + **12 pentagons** at icosahedron vertices).  
4. Practice input CRS: **EPSG:4326** lon/lat into H3.

---

## 2. Coordinate systems used with H3

### Geographic

| System | Use |
|--------|-----|
| **WGS84 lon/lat (EPSG:4326)** | `latLngToCell` / `cellToLatLng` |
| **Cell boundary** | `cellToBoundary` polygon |
| **Local projected (EPSG:2966)** | Convert to lon/lat **before** H3 |

### Discrete hex coordinates

| System | Components | Constraint |
|--------|------------|------------|
| **Cube** | `(i, j, k)` | `i + j + k = 0` |
| **Axial** | `(q, r)` | `s = -q - r` |
| **FaceIJK** | face + IJK | H3 internal |

**Cube distance:** `max(|Δi|, |Δj|, |Δk|)`

### H3 index

64-bit ID (hex string). Resolution **0–15**.  
`|gridDisk(k)| = 3k(k+1)+1` · `|gridRing(k)| = 6k` (k>0).

---

## 3. TSM resolution policy

| Use case | Res | Approx edge |
|----------|-----|-------------|
| Regional | **5** | ~8.5 km |
| Community | **7** | ~1.2 km |
| Local / gage | **9** | ~174 m |
| Site | **11** | ~25 m |
| Evidence default | **9** | — |

---

## 4. Engineering

Helpers in `packages/geo/src/h3/coordinates.ts`. Runtime cells via **h3-js** / **h3-pg**.  
H3 IDs preferred over UE WP cell names for durable keys.  
H3 does not replace NAVD88/gage datum or FEMA SFHA.

Human authority remains final.
