# Esri Forked Repos → TSM Implementation Guide — 2026-10-17

The user has forked 30 Esri repositories. Here's how each maps to TSM implementation.

## High Priority (direct TSM use)

| Repo | What it is | TSM use |
|------|------------|---------|
| `arcgis-rest-js` | JavaScript/TypeScript wrapper for ArcGIS REST API | Replace manual fetch calls in `tsm-console/src/lib/` with typed REST JS calls for FeatureServer queries, geocoding, routing |
| `arcgis-python-api` | Python API for ArcGIS Online/Enterprise | Automate data pipelines: publish derived layers, manage hosted feature services, batch geoprocessing |
| `jsapi-resources` | Code samples for ArcGIS JS API | Reference patterns for web map configuration, layer styling, popups |
| `arcgis-experience-builder-sdk-resources` | Custom widgets for Experience Builder | Build TSM-specific widgets (FARA generator, elevation profiler) |
| `developer-support` | Esri support scripts and tools | Troubleshooting REST API issues, service health checks |

## Medium Priority (reference/patterns)

| Repo | What it is | TSM use |
|------|------------|---------|
| `arcgis-cookbook` | Admin automation recipes | Automate ArcGIS Online org management |
| `ago-assistant` | Copy content between orgs | Migrate TSM layers between dev/prod |
| `esri-leaflet` | Leaflet plugin for ArcGIS | Reference for REST query patterns (we use MapLibre, not Leaflet) |
| `esri-leaflet-geocoder` | Geocoding widget | Reference for Indiana address search implementation |
| `arcade-expressions` | Arcade language samples | Smart mapping expressions for flood layers |
| `calcite-design-system` | Esri's design system | UI component reference for government-facing design |

## Low Priority / Specialized

| Repo | What it is | TSM relevance |
|------|------------|---------------|
| `arcgis-maps-sdk-*` | Native SDKs (Qt, .NET, Unity) | Not needed — TSM is web-based |
| `raster-functions`, `raster-deep-learning` | Raster processing | Future: automated DEM analysis |
| `cityengine_for_unreal` | 3D city modeling | Future: LOD2 building generation |
| `deep-learning-frameworks` | ML for imagery | Future: building detection from imagery |

## Implementation Plan

### Phase 1: arcgis-rest-js integration
Replace manual `fetch()` calls to ArcGIS REST endpoints in `tsm-console/src/lib/` with `@esri/arcgis-rest-*` packages:
- `@esri/arcgis-rest-request` — base request handler
- `@esri/arcgis-rest-feature-service` — FeatureServer queries
- `@esri/arcgis-rest-geocoding` — Indiana address search

### Phase 2: arcgis-python-api pipelines
Create `scripts/arcgis/` using the Python API for:
- Publishing derived layers (buildings with heights, levee data)
- Scheduled data refresh from source FeatureServers
- Automated QA checks on hosted layers

### Phase 3: Experience Builder widgets
Using `arcgis-experience-builder-sdk-resources` as reference, build:
- FARA report generator widget
- Elevation profile widget
- Multi-county comparison widget
