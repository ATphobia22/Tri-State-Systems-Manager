# Data Fabrics Downloads — 2026-10-17

Downloaded from verified sources per MISSING.md / PROVENANCE.md audit.

## Acquired

| Dataset | File | Count/Size | Source |
|---------|------|------------|--------|
| NWPS MTVI3 | nwps/MTVI3.json | 33 KB | api.water.noaa.gov |
| NWPS UNWK2 | nwps/UNWK2.json | 34 KB | api.water.noaa.gov |
| NWPS EVVI3 | nwps/EVVI3.json | 42 KB | api.water.noaa.gov |
| USGS 03378500 | usgs-water/latest-continuous-03378500.json | 5 KB | api.waterdata.usgs.gov |
| Posey CSLF Feb 2025 | cslf/posey-cslf-feb2025.geojson | 4,131 features | gisdata.in.gov |
| USGS 3DEP 1m DEM | usgs-3dep-1m/USGS_1M_16_x41y419_IN.tif | 246 MB | prd-tnm.s3.amazonaws.com (direct HTTPS) |

## Working alternatives found (2026-10-17 deep search)

- **USGS 3DEP**: Direct HTTPS to `prd-tnm.s3.amazonaws.com` works (S3 API blocked, plain HTTPS OK)
- **Overture buildings**: Azure Blob Storage `overturemapswestus2.blob.core.windows.net` works
- **Indiana LiDAR DEM**: ArcGIS ImageServer `di-ingov.img.arcgis.com` exportImage works
- **FEMA NFHL**: Still blocked; use IDNR ArcGIS Online layers (different authority class)
- **USACE NLD**: Site loads; API routes need browser discovery

## Blocked (infrastructure)

- **FEMA NFHL** — hazards.fema.gov returns empty via egress proxy
- **USACE NLD2** — ags03.sec.usace.army.mil unreachable via egress proxy  
- **AWS S3** (in-elevation, prd-tnm, naip) — blocked by proxy (407)
- **Overture S3** — blocked by proxy (from earlier attempt)

## Requires user contact

Per MISSING.md:
- Data Rescue archives (4) — user must supply or mark REQUIRES_CONTACT
- LOMA Case 26-05-2022A PDF — user must upload
- Union KY parcels — contact PVA Clay Wells 270-389-1933

## Authority

All data public domain (federal) or CC0 (Indiana). CSLF is preliminary Feb 2025, not effective FEMA mapping.
