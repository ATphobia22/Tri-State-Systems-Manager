# Data fabrics status — unfinished / fixed / next download (2026-10-17)

Deep web + live probe of sources that feed the Tri-State Systems Manager four-plane stack.

## Status matrix

| Fabric | Status | Latest finding | Action taken |
|--------|--------|----------------|--------------|
| **TSM buildings-3d / NDHM heights** | **Production** | 22,815 features on Pages; height_m present | 20 m MS gate re-run (median Δh ~1.0 m) |
| **Microsoft ML footprints** | **Validated** | Tile 032000212 = 42,965 / 24,583 heights | Downloaded and recounted |
| **Overture building** | **Extract complete** | Release 2026-09-23.1; Posey 24,375 | Parquet extract in artifacts; S3 manifests on main |
| **Overture building_part** | **Extract complete** | Posey only **15** parts (rural) | Extract + manifest on main |
| **Overture map toggles on Twin** | **Not UI-wired** | Optional DERIVED overlay | Docs only — keep separate license/authority |
| **NID dams (Posey)** | **Incomplete official download** | Portal live (~92k national); REST/API 400/404 from sandbox | Screening inventory of **5** Posey dams from secondary NID-derived tables; coords APPROX |
| **IGIO building footprints service** | **Probe failed 404** | Catalog still lists Building_Footprints_2016_2020 | Prefer buildings-3d production path; re-check IGIO URL |
| **IGIO parcels 2025** | **Service up** | Hosted/Parcel_Boundaries_of_Indiana_2025 | Query by geometry (field names vary) |
| **FEMA NFHL effective** | **Live** | MapServer layer 28: **123** zone features for DFIRM 18129% | Sample AE/A distribution fetched |
| **Posey CSLF** | **Catalogued** | Indiana Hosted Posey_CSLF_Feb2025 | CONTEXT / preliminary only |
| **Critical facilities** | **Screening only** | FacilityStatusDashboard uses SCREENING_INVENTORY | Swap to HIFLD/official when download path stable |
| **HIFLD fire stations** | **Probe failed** | ArcGIS query Bad Request | Retry alternate HIFLD endpoint later |
| **Live stage fabric** | **Production path** | USGS OGC + NWPS; reject −999 | Keep gage-zero validation rules |
| **data/fabrics/live** | **Empty dir** | Placeholder for live fabric cache | Populate with stage snapshots optionally |

## Authoritative download links

| Source | URL |
|--------|-----|
| NID portal | https://nid.sec.usace.army.mil/ |
| NID fact sheet | https://www.agc.army.mil/Media/Fact-Sheets/Fact-Sheet-Article-View/Article/480923/national-inventory-of-dams |
| FEMA NFHL MapServer | https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer |
| Overture buildings S3 | `s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/` |
| Overture docs | https://docs.overturemaps.org/guides/buildings/ |
| Microsoft footprints | https://github.com/microsoft/GlobalMLBuildingFootprints |
| IGIO Data Harvest | https://dataharvest.gio.in.gov/pages/data-access |
| Indiana parcels 2025 | https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer |

## Still unfinished

1. **Official NID geometry** for Posey (CSV/GPKG from portal) — screening JSON is interim.
2. **Twin Canvas toggles** for Microsoft/Overture GeoJSON (optional DERIVED).
3. **HIFLD / official critical facilities** replace SCREENING_INVENTORY.
4. **IGIO FeatureServer URL drift** — verify current building footprint service name.
5. **data/fabrics/live** population (optional gauge/NFHL snapshots).

## Authority

SCREENING / DERIVED / CONTEXT layers never become REGULATORY without human-authorized evidence artifacts.
