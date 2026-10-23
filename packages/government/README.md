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
