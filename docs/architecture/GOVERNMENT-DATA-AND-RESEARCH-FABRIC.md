# Government Data and Research Fabric

## Contract

Government source retrieval returns a typed evidence envelope with result, HTTPS citations, retrieval timestamp, authority/source ID, raw response SHA-256, canonical result SHA-256, and a trace ID. Hashes prove byte/content identity, not correctness or regulatory authority. The default status is `UNVERIFIED`; downstream promotion must pass the existing data-fabric quality and lineage gates.

## Source coverage

The UACF gateway registers `GovernmentDataProvider` for the read-only `geo.nfhl.query` capability under the `tsm:geospatial` permission. The registry defines FEMA NFHL; USGS 3DEP and the current 3D Hydrography Program (3DHP) service; NOAA NWS and CO-OPS; Census API/TIGER; EPA WATERS discovery; USDA soil-data discovery; FHWA bridge inventory discovery; and USACE levee/study discovery. Provider URLs are constrained to the registered HTTPS origin and path. The 3DHP service is the current USGS hydrography program endpoint; legacy NHD products remain available for reference and may supplement areas without elevation-derived hydrography. Source-specific coverage, vintage, units, CRS, datum, quality flags, and query semantics still require validation before engineering use.

## Research adapters

`researchSearch` accepts injected GitHub, search, browser, Firecrawl-compatible, Exa-compatible, and government API provider implementations through the `ResearchProvider` interface. It verifies source text hashes, rejects non-HTTPS URLs, deduplicates deterministically, retains retrieval metadata, and labels raw retrieval as unverified. It does not invent an AI answer or claim unsupported citations; synthesis must be a separate evidence-linked stage.

## NFHL drift validation

The existing NFHL validator compares the live ArcGIS service with the committed 32-layer inventory. Nightly automation should run against FEMA availability, preserve the resulting artifact, and fail when live data is available but violates the pinned layer contract. Network unavailability must be recorded as unavailable, not converted to a successful validation. Expected layer names and geometry types should be reviewed against FEMA's current service metadata before changing the pinned registry.

## Not claimed complete

These package boundaries and source registrations do not by themselves establish full query coverage, complete offline snapshots, operational PostGIS, complete MapLibre integration, or validated hydrology. A dataset must be imported, hashed, schema-validated, versioned, attributed, and reviewed before promotion into the digital twin. Offline operation requires pre-acquired and verified source snapshots.
