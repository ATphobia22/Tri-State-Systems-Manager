# Google Drive → GitHub Pages 4D Atlas asset readiness

**Audit date:** 2026-11-13  
**Scope:** Public GitHub Pages prototype for the Ohio–Wabash River Valley (IN/IL/KY).  
**Evidence class:** Drive discovery and *manifest inspection only*. This is not a production publication receipt, regulatory proof, raster datum attestation, or a successful headed runtime test.

## Sources inspected

- Drive folder **TSM 3D Tiles — Tri-State IN-IL-KY Height-Verified LOD1 Buildings and Terrain 2026-11-13**, including county directories, Terrain, and Manifests.
- Drive manifest **Manifests/all.json** and **posey-fixed.json**, generated 2026-11-13.
- Drive folder **TSM Tri-State Map Pack 2026-10-01**: `tsm-data-fabric-pack-20261001.zip` (~7.6 MB) and `tsm-tristate-map-pack-20261001.zip` (~158.5 MB).
- Drive's older **Tri-State River Valley 3D 4D OpenWorld - Real as Possible.html** reviewed as a legacy design/prototype reference **only**. It includes parcel-specific/site-specific claims and CDN dependencies; it must not be pasted into an anonymous public Atlas.
- The GitHub repository's checked-in `tsm-console/public/data/tsm-river-gauge-locations.geojson` (10 coordinate-only points) and `ehydro-survey-extents.geojson` (20 rectangles from real survey geometry). These are the two source-derived Atlas overlays currently integrated.

## Archive inventory (metadata, not published geometry)

The Drive aggregate manifest contains 15 separately packaged units: a Posey repair archive; seven other counties' building archives (Gallatin, Wabash, White, Union, Henderson, Warrick, Vanderburgh); and seven terrain collections (Wabash, Union, Gallatin, Henderson, White, Vanderburgh, Warrick).

| Candidate | Manifest report | Pages action |
| --- | --- | --- |
| Posey repair archive | 42,837 packaged files, 202,874,754 uncompressed bytes; one 24,767,064-byte compressed part | Do **not** equate packaged file count with 23,082 verified building footprints. Reconcile IDs, geometry, LoD and height evidence |
| Non-Posey county buildings | Seven county archives, individually SHA-256 listed | Extract, audit feature identity, provenance, tile index, geodetic placement, license and size before optional publication |
| Regional terrain | Seven county archive families; several have multi-part packaging | Validate DEM vertical datum, tiles, depth/elevation units, coverage, metadata, missing tiles and user privacy; not served by Pages today |
| Legacy map ZIPs | ~7.6 MB data-fabric and ~158.5 MB map pack in Drive | Inspect source and licenses before choosing a small, verified public subset |
| eHydro survey extents | 20 local WGS84 polygons, vertical reference **Ohio River Datum** | Render outline only; no ORD→NAVD88 conversion or depth surface implied |
| USGS gauge locations | 10 local WGS84 points | Render markers only; no water-level values, flood thresholds or live source health implied |

**Manifest inconsistency:** The Drive aggregate manifest records `uploaded: false` for its parts, even though at least the Posey part file appears in Drive. Likewise, the manifest records some terrain parts as `verified: false` while other archive parts are flagged `verified: true`. Neither flag is an independent byte-for-byte validation in this audit. Re-read Drive metadata, download each authorized part, recompute SHA-256, validate decompression, compare the extracted inventory, then build a publishable manifest before treating any archive as a live Atlas asset.

**Coordinate warning:** `tsm-console/public/data/leveed-areas-wabash-v1.geojson` contains coordinate values around -9,714,852 / 4,680,537, consistent with projected Web Mercator meters, not longitude/latitude degrees. Do not add this file as a normal MapLibre GeoJSON source until geometry CRS is verified and converted to EPSG:4326 with a recorded transform; distinguish leveed areas from flood protection assurances.

## Current browser connections

- The Pages-only root route now redirects to the source-backed `/atlas` experience. The regular app root is unchanged; the memorial is available under `/memorial`.
- The Atlas reuses the existing MapLibre map and its source registry. OpenFreeMap's vector style gives the scene contextual roads across IN/IL/KY, whereas Indiana aerial imagery must be suppressed outside Indiana.
- Local GeoJSON overlays draw 10 USGS monitoring-location coordinates and 20 USACE eHydro survey rectangles. The Pages Atlas offers two separately labeled observation paths: a **user-triggered direct USGS OGC API v1 gage-height reader** (subject to public API/browser access) and an **optional** TSM API/NOAA advanced station board. Neither silently polls or invents NAVD88 water levels; unavailable requests remain explicitly unavailable.
- The hour slider changes visual lighting only. Genuine 4D hydrologic replay needs time-indexed observations and/or versioned scenario model outputs with independent authority and calibration gates.
- Scene sketches are explicitly unverified planning geometries; no edit, flood model, regulatory filing, or professional sign-off occurs from a browser click.

## Publication gate

1. Confirm permission to publish each Drive-derived file; identify/remove parcel-specific personal information and credentials.
2. Reassemble/download the archived files; verify complete SHA-256 and extracted counts, not just folder titles or metadata flags.
3. Validate source acquisition/effective dates, coordinate reference system, horizontal and vertical datum, units, tile bounds, height evidence class and LOD tags.
4. Produce constrained, optimized public GeoJSON/PMTiles/3D Tiles and immutable manifests. Do not place massive multi-part terrain archives directly in a GitHub Pages dist folder.
5. Add static browser tests for routing, expected file paths, source counts, tile decode/render, cross-state region switching, missing-source UI and keyboard navigation.
6. Promote only after CI artifact tests **and** a separate headed, published Pages smoke test pass. Keep Unreal Windows Shipping, HEC-RAS coupling and full 23,082 verified height-linked Posey features as independent release gates.

Public map geometry, source provenance, and browser lighting must remain distinct from engineering calculations and from administrative determinations.
