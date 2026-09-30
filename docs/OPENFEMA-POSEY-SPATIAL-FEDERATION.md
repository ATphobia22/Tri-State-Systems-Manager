# OpenFEMA + Posey Parcel Spatial Federation

TSM treats OpenFEMA and the FEMA NFHL as complementary authority products.

## Runtime chain

XSoft Posey parcel
→ normalized StateCombi
→ verified ArcGIS parcel polygon
→ FEMA NFHL FIRM-panel intersection
→ FEMA NFHL flood-zone intersection
→ Indiana DNR Best Available flood intersection
→ USGS 3DEP EPQS terrain sample
→ OpenFEMA NFIP program context
→ explicit HEC-RAS/model artifact
→ simulation/provenance envelope

## OpenFEMA implementation

Base URL: `https://www.fema.gov/api/open`

Implemented:
- versioned, allowlisted entities;
- strict `$filter`, `$select`, `$orderby`, `$top`, `$skip`, `$count` and `$metadata` handling;
- JSON/JSONA/JSONL/GeoJSON/CSV/Parquet format selection;
- deterministic paging;
- single-record retrieval;
- SHA-256 hashing;
- source health through the existing TSM HTTP client.

OpenFEMA does not replace NFHL spatial geometry.

## Privacy and authority

NFIP claims/policies are redacted federal program datasets. They are not joined to private owners, residences, APNs or individual engineering decisions.

FEMA effective flood geometry comes from the NFHL ArcGIS service. Indiana BAFL remains a separate state best-available plane. USGS elevation remains source terrain evidence.

## Hydraulic gate

The chain intentionally terminates at `hydraulicModelStatus=NOT_ATTACHED` until a HEC-RAS artifact supplies model geometry, CRS, vertical datum, scenario, input hashes and result hashes.

No WSE, depth, velocity, arrival time, insurance determination, or engineering recommendation is fabricated from polygon-only evidence.
