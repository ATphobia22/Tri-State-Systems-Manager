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
