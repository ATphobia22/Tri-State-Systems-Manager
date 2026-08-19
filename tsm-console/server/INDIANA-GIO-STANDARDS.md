# Indiana GIO Data Standards — TSM Alignment

## Statutory basis
- **IC 4-23-7.3** — Indiana GIS Mapping Standards (framework data, data exchange agreements, IGIO role)

## Data Harvest (IGIO)
- Annual collection of county **address points**, **street centerlines**, **parcel boundaries**, **administrative boundaries**
- 2024/2025 harvest uses validation portal (VEP) aligned with **NENA NG911** data models
- Preferred delivery: file geodatabase or shapefile per IGIO template
- Feature services (examples): gisdata.in.gov Hosted Road_Centerlines / Parcel_Boundaries / Administrative_Boundaries

## Imagery
- Indiana GIO orthophotography program: multi-resolution (including 3-inch and 6-inch classes by tier/year)
- 4-band (RGB + NIR) products support CIR and NDVI raster functions
- **Derived GPU/NDVI products are DERIVED / VISUALIZATION — not authoritative observations**

## TSM ingestion rules
1. Prefer IGIO / Data Harvest published services over unofficial mirrors
2. Capture acquisition epoch, CRS, and band metadata in EvidenceArtifact.transformation_chain
3. Fail-closed if schema validation against harvest template fails
4. Parcels/addresses used for community context only unless cadastral authority is verified for the specific county endpoint

## Posey County
- Parcel endpoint (e.g. XSoft) remains **PROVISIONAL** until response captured and schema-validated (Authority Registry v35)
