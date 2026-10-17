# Esri Integration Inventory — 2026-10-17

## ArcGIS Services Already in Use

### Indiana (gisdata.in.gov)
- Best Available Flood Hazard Layer (MapServer)
- Address Points of Indiana (FeatureServer)
- Building Footprints (FeatureServer)
- PLSS Indiana State Boundary (FeatureServer)
- Parcel Boundaries of Indiana 2025 (FeatureServer)
- Posey CSLF Feb2025 (FeatureServer)
- Road Centerlines of Indiana (FeatureServer)
- Indiana 2016-2020 DEM (ImageServer)
- Indiana Current Imagery (ImageServer)

### Indiana DNR (ArcGIS Online)
- 500 Yr Floodplain (FeatureServer)
- FloodHazard Best Merge 500 (FeatureServer)
- Flood Zones (FeatureServer)

### Federal
- FEMA NFHL (MapServer) — hazards.fema.gov
- USGS 3DEP Elevation (ImageServer)
- USGS 3DEP Elevation Index (MapServer)
- USACE NLD (FeatureServer) — geospatial.sec.usace.army.mil

## Esri Patterns to Adopt

From https://www.esri.com/en-us/arcgis/products/arcgis-online/resources:

1. **Hosted Feature Layers** — Publish our derived datasets (building footprints with heights, levee data) as hosted feature layers for the console to consume via REST
   - Guide: https://doc.arcgis.com/en/arcgis-online/manage-data/publish-features.htm

2. **ArcGIS REST API** — Already using; standardize query patterns across all services
   - Docs: https://developers.arcgis.com/rest/

3. **ArcGIS API for Python** — For automated data pipelines (instead of manual curl)
   - Docs: https://developers.arcgis.com/python/latest/

4. **Web Maps** — Create authoritative web maps for the tri-state area combining our layers
   - Guide: https://doc.arcgis.com/en/arcgis-online/create-maps/create-maps-and-apps.htm

5. **Experience Builder** — The INFIP app is built with this; we could build a TSM Experience
   - Docs: https://doc.arcgis.com/en/experience-builder/latest/get-started/what-is-arcgis-experience-builder.htm

## Implementation Priority

1. Standardize all ArcGIS REST queries through a single client module
2. Add ArcGIS API for Python to data pipelines
3. Publish derived layers as hosted feature services
4. Build TSM web map combining all 8 counties
