# 3DEP Terrain-RGB Production Pipeline

## Purpose

This document defines the source-backed terrain pipeline used by the TSM open-world twin. It does not redistribute USGS source rasters and does not certify survey-grade terrain.

## Authoritative acquisition

1. Discover 3DEP products with USGS TNMAccess and the 3DEP Elevation Index.
2. Select the best available lidar/DEM product for the AOI, preferring 1 m where available.
3. Record the source URI, product identifier/version, acquisition timestamp, source CRS, vertical datum, and source SHA-256.
4. Reject an acquisition that lacks source identity, version, CRS, vertical datum, or a reproducible hash.

## Processing contract

```text
3DEP GeoTIFF/DEM
  -> gdalwarp (explicit CRS/transformation)
  -> hydro-enforcement / conditioning (recorded transformation)
  -> rio-rgbify (Mapbox Terrain-RGB encoding)
  -> XYZ or PMTiles
  -> Martin tile service (optional)
  -> MapLibre raster-dem
  -> setTerrain()
```

Terrain processing must preserve vertical-datum provenance. A reprojection is not a vertical datum conversion unless the transformation is explicitly recorded.

## Runtime configuration

`VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` is the browser-facing XYZ template. Example shape:

```text
https://tiles.example.invalid/terrain/{z}/{x}/{y}.png
```

The repository intentionally does not contain a fabricated or placeholder operational tile endpoint. If the variable is absent, the twin reports terrain as not configured and does not substitute synthetic elevation.

## Tile requirements

- MapLibre source type: `raster-dem`
- Encoding: `mapbox`
- Tile size: 256 pixels unless the serving profile explicitly requires another size
- Web Mercator tiles for browser delivery; source processing CRS remains recorded separately
- Terrain exaggeration defaults to `1.0`
- AOI/zoom limits must be documented by the deployed tile service

## EvidenceArtifact requirements

Each acquisition/processing release should create an EvidenceArtifact containing:

- `source_authority=USGS 3DEP`
- authoritative source URI
- source identifier/version
- `retrieved_at`
- `content_hash_sha256`
- horizontal CRS and vertical datum
- transformation chain
- software/tool versions
- validation status
- human review status

The hash establishes integrity/provenance; it does not establish regulatory or survey authority.

## No bulk source-data policy

Do not commit source lidar/DEM payloads, generated tile pyramids, or planet-scale terrain meshes to Git. Deploy tiles through an appropriate object store/CDN/Martin/PMTiles service and retain manifests/EvidenceArtifacts in TSM.

## Operational acceptance

A terrain deployment is acceptable only when the tile URL resolves, the MapLibre `raster-dem` source loads, `setTerrain()` succeeds, and the acquisition manifest can be traced to an authoritative 3DEP product. Missing or invalid terrain configuration fails closed to a 2D imagery map rather than inventing terrain.

## Materialized build — 2026-09-27

The pipeline above was executed end-to-end against the bundled screening DEM:

```bash
python3 tools/terrain/fetch-terrarium-dem.py --zoom 13
./scripts/geospatial/build-terrain-rgb-screening.sh
python3 scripts/geospatial/pack-terrain-mbtiles.py \
  --tile-dir ops/terrain-tiles/data/terrain-rgb \
  --out dist/terrain-tiles/terrain-3dep.mbtiles
```

**Toolchain substitution (recorded).** GDAL/rio-rgbify are not installed on
the build host. `scripts/geospatial/build-terrain-rgb-tiles.py` implements
the Mapbox Terrain-RGB encoding directly in pure Python (numpy + Pillow);
the encoding is byte-identical to the spec. The build round-trips a center
tile through the decoder and fails if drift exceeds 0.2 ft (observed
0.12 ft, sub-quantization).

**Outputs.**

- 28 tiles, z11–z15, 256 px, XYZ PNG + TileJSON in
  `ops/terrain-tiles/data/terrain-rgb/` (build working dir, not committed).
- `dist/terrain-tiles/terrain-3dep.mbtiles` (28 rows verified, source id
  `terrain_3dep`, SHA-256
  `83f94cf76f3220d3d2e140bc7a56e3baf0a9ba31a5576c97aea5f78d9b17a696`) —
  a build artifact under the gitignored `dist/`; transfer it to the tile
  host, do not commit it, per the no-bulk-source-data policy.
- Served tile decode check: 356.0–370.7 ft, mean 362.5 ft — consistent with
  the source DEM (337.7–372.5 ft).

**Serving (production: GitHub Pages).** The tile pyramid is published with the
site itself — no tile host, no DNS, no TLS termination to operate. The 28
PNGs + `tiles.json` live in `tsm-console/public/terrain_3dep/` (documented
carve-out to the no-generated-pyramids policy: 252 KB, screening-level,
regenerated wholesale by the build script) and deploy to:

```text
https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png
```

Same-origin HTTPS, so there are no mixed-content blocks and no CORS
configuration. Set `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` to that template in
the GitHub `github-pages` environment; the next Pages build registers
`tsm-terrain-rgb` and enables 3D terrain. Refresh = re-run §1, replace
`public/terrain_3dep/`, push.

**Serving (alternative: dedicated tile host).**
`ops/terrain-tiles/docker-compose.yml` (pinned `ghcr.io/maplibre/martin:v0.17.1`
+ Caddy 2.9 automatic TLS) remains available if a custom domain is wanted
later: `https://<TILE_DOMAIN>/terrain_3dep/{z}/{x}/{y}.png`. Local dev uses
`ops/terrain-tiles/server.mjs` (Express+TLS, self-signed cert).

**Configuration.** Production variable `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE`
is set in the GitHub `github-pages` environment (requires repo admin; not
settable from the build host). Template resolution is fail-closed
(`resolveTerrainTemplate` in `tsm-console/src/lib/twin-map-style.ts`):
must be `https://`, contain `{z}/{x}/{y}`, and not be a placeholder —
otherwise the twin stays flat.

**Datum correction.** The tile grid is Web Mercator (EPSG:3857); vertical is
NAVD88 as reported by the 3DEP source, carried through without
transformation or certification. EPSG:2966 (a horizontal CRS) is not claimed
for this product.

Evidence ledger: `artifacts/tsm-terrain-rgb-3dep-pipeline-v1.json`.
