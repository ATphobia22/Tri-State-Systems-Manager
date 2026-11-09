# TSM/UACF Government Data Fabric

This package separates source registration, bounded source retrieval, metadata/schema validation, content hashing, and dataset promotion. The in-code source registry is a catalogue, not a claim that all providers are fully integrated.

## Implemented in this milestone
- Read-only FEMA NFHL layer queries registered as UACF capability `geo.nfhl.query`.
- Allowlisted JSON source retrieval for registered REST JSON endpoints, citations, trace IDs, and SHA-256 evidence hashes.
- Static source metadata for FEMA, USGS, NOAA, Census, EPA, USDA, DOT/FHWA, and USACE.
- Dataset, geometry, and layer-metadata validators plus JSON Schema.
- PostgreSQL migration proposal for sources, ingestion runs, datasets, and provenance.

## Explicit boundaries
The SQL migration is not automatically applied and no PostGIS instance is provisioned by this package. Download/catalog sources require specialized adapters. Dataset promotion is not the same as importing a full authoritative feature dataset. MapLibre/vector-tile publication and production digital-twin ingestion require storage, CRS/datum validation, licensing review, and deployment configuration. Unimplemented capabilities must remain unavailable rather than returning fabricated results.

## Validation
Run `npm run test:government-fabric` and `npm run build:uacf`. Live FEMA metadata drift validation is run by the dedicated scheduled workflow.

## Experimental live HTTP connector module (2026-11-09)

The existing typed UACF fabric at `src/index.ts` remains canonical. The separate zero-dependency `src/index.mjs` provides a **read-only, experimental** NWS/USGS/FEMA live transport; it is **not yet registered** as a UACF capability or PostGIS ingestion job. Do not mistake the two `GOVERNMENT_SOURCES` representations for an interchangeable schema.

Configure `TSM_NWS_USER_AGENT` with a real application identifier before using the NWS API. Run `node --test tests/contracts/government-fabric.test.mjs` from the repository root. The live transport returns SHA-256 hashes of retrieved response bytes and explicitly marks evidence provisional. Its FEMA function retrieves service layer metadata, not a regulatory determination; its USGS station function currently obtains IV JSON with embedded site metadata, not a full station catalog. Forecast point lookup and forecast retrieval produce separate evidence records.

Before promotion into the existing fabric, add typed adapters that translate the experimental transport envelopes into the canonical `EvidenceEnvelope<T>` and `GovernmentSource` types, with schema validation, datum metadata, bounded pagination, retry policy, stale-data status, tests and source registration. The module has no persistent storage, PMTiles output, MapLibre integration or Windows offline staging.

Google Drive searches surfaced candidate architecture blueprints, TSM map packs, dashboards, and FEMA/LOMA guidance; no Drive document is automatically accepted as authoritative data or imported into this package.
