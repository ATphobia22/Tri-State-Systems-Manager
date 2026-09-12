# Open-World 3D Twin and HEC-RAS 2D Mesh v1.0

## Purpose

This document defines the source-backed geospatial visualization and HEC-RAS 2D engineering contract for the Tri-State Systems Manager. It does not create a regulatory flood determination and does not replace FEMA, Indiana DNR, USACE, or a qualified engineer.

## Live Hydrology

- USGS station: `03378500` — Wabash River at New Harmony, Indiana.
- NOAA NWPS gauge: `NHRI3`.
- Runtime source order: NOAA NWPS observed stage, then USGS Water Data.
- USGS qualifier `P` (Provisional) must remain visible whenever supplied.
- Project evidence snapshot: 2026-09-12 04:30 CDT, 4.43 ft stage, 18,300 cfs, provisional. Runtime refresh is required before operational display.
- Project gage-zero conversion constant: 352.71 ft NAVD88. Conversions are explicit and never silently applied.

## Floodplain Authority Separation

### FEMA NFHL — Effective / Insurance

Service: `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`

Relevant products include Flood Hazard Zones (28), Base Flood Elevations (16), FIRM Panels (3), LOMA/LOMR products, and levee-related layers. NFHL remains the effective FEMA insurance/effective-map evidence plane.

### Indiana BAFM — Planning / Flood Control Act

Service: `https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer`

Relevant project layers include 104 and 438. BAFM is used for Indiana planning/construction and Flood Control Act context and is not substituted for effective FEMA insurance mapping.

**Implementation rule:** NFHL and BAFM must remain separate layers, legends, provenance, and authority classifications. Never create a single merged `floodZone` authority.

## Open-World 3D Twin

### Photorealistic Surface

Primary source: Indiana Current Imagery ImageServer:

`https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer`

Browser rendering uses service-compatible tile access; source imagery is not bulk-copied into the repository.

### Terrain

Preferred source: USGS 3DEP 1 m or best available lidar. Discovery uses TNMAccess and the 3DEP index. Production tile processing is:

`GeoTIFF/DEM -> gdalwarp -> hydro-enforcement -> rio-rgbify -> PMTiles/XYZ -> Martin -> MapLibre raster-dem -> setTerrain()`

The runtime terrain tile template is supplied by `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE`. If absent, the application explicitly reports that operational terrain is not configured rather than fabricating terrain.

Every acquired terrain product requires an EvidenceArtifact containing source URI, acquisition time, SHA-256 hash, CRS, vertical datum, and transformation chain. Bulk source rasters are not committed to Git.

## HEC-RAS 2D Mesh Guidance

| Zone | Nominal cell-size target |
|---|---:|
| Channel / conveyance | 25–50 ft |
| Near berm / structures / LAG | 25–40 ft |
| Active floodplain | 50–100 ft |
| Overbank / agricultural | 100–200 ft |

These are project refinement targets, not universal USACE-prescribed values. Final resolution requires engineering judgment, sensitivity testing, and calibration/verification.

### Terrain and Breaklines

- Terrain: hydro-enforced 3DEP/best-available lidar, preferably 1 m.
- Required breaklines: channel centerline, left bank, right bank, berm crest.
- Additional breaklines: structure edges and roadway crests where hydraulically material.
- Berm crest project constant: 379.8 ft NAVD88.
- Sub-grid hydraulic property tables may use high-resolution underlying terrain while computational cells remain larger where appropriate.

### Project Constants

- LAG: 377.2 ft
- BFE: 375.0 ft
- Berm crest: 379.8 ft
- FFE: 382.5 ft
- No-rise tolerance: 0.0 ft
- Compensatory storage analysis: 1.2x–1.3x project policy range

These are project-profile inputs, not universal regulatory thresholds.

### Boundary Conditions

The project contract identifies USGS `03378500` / NOAA `NHRI3` as the observed hydrologic source pair. Manning's n values, downstream Myers-pool conditions, bathymetry, and other hydraulic inputs must retain provenance and engineering review status.

## Authority and Evidence

All HEC-RAS inputs/outputs and derived inundation products are labeled `SIMULATION_DEMO` or `MODEL_OUTPUT`, carry SHA-256 EvidenceArtifact metadata, and remain `human_review_required`. They cannot self-promote to regulatory authority.

## Browser Layer Contract

```text
Indiana Current Imagery
        |
3DEP Terrain-RGB -> raster-dem -> setTerrain()
        |
+-------------------------------+
| FEMA NFHL | Indiana BAFM      |
| effective | planning          |
+-------------------------------+
        |
Live stage -> explicit NAVD88 WSE metadata
        |
HEC-RAS results -> simulation/model evidence
```

## Operational Checklist

- [ ] Runtime API is reachable and `/api/hydrologic/live` returns current telemetry.
- [ ] Provisional qualifier is visible when supplied.
- [ ] Indiana Current Imagery loads from the authoritative ImageServer.
- [ ] `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` points to a real Terrain-RGB tile service before enabling operational terrain.
- [ ] NFHL and BAFM are independently togglable and independently labeled.
- [ ] HEC-RAS project inputs include CRS, vertical datum, terrain provenance, breaklines, and boundary-condition provenance.
- [ ] Model artifacts contain SHA-256 evidence metadata.
- [ ] Model outputs remain simulation/model evidence and require human review.
- [ ] No synthetic production parcel/terrain geometry is used.
- [ ] GitHub Actions parse, typecheck, build, data-fabric, geospatial, and mock-data checks are green before release.
