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

## 2026-11-09 specialized UACF integration and publication pipeline

The canonical `GovernmentSourceCapabilityProvider` now advertises `source.lookup`, a bounded, user-initiated dispatcher for: `usda.ssurgo:point`, `fema.loma:discover/case`, `fema.lomr:discover/case`, `epa.facilities:zip`, `army-corps.levees:metadata`, and `census.tiger:metadata`. Existing NLD, ECHO and TIGERweb implementation is reused. LOMA/LOMR lookup is **NFHL layer discovery and constrained spatial-case attribute querying**, not a complete nationwide FEMA MSC determination database; many cases may be absent.

`sql/001_government_fabric_postgis.sql` establishes optional PostGIS tables for source identity, immutable datasets and geometry features. `src/fabric/PostgisGovernmentRepository.ts` is an injected SQL-pool repository that checks raw GeoJSON against a required PASS snapshot manifest and SHA-256 hash, checks source provenance and coordinates, then performs transactional ingestion. Nothing is automatically migrated, provisioned or connected to an operational database; caller must provide connection, authorization, license metadata, and ingestion service. All geometries must be explicitly transformed to EPSG:4326 before import. No regulatory acceptance is inferred.

`scripts/publish-pmtiles.mjs` builds immutable PMTiles from a previously validated EPSG:4326 GeoJSON FeatureCollection and matching manifest using preinstalled Tippecanoe 2.17+. Example:

```bash
node packages/government/scripts/publish-pmtiles.mjs \
  /verified/flood-zones.geojson /verified/manifest.json \
  /published/flood-zones.pmtiles flood_zones
```

The CLI emits `flood-zones.pmtiles.manifest.json` with both raw-source and tile SHA-256 values. Tiling does not scientifically validate geometries; output is labeled `BUILT_NOT_FIELD_VERIFIED`. Host both artifacts at stable immutable HTTPS URLs before using the MapLibre overlay.

The RealWorldTwinMap has an opt-in government tiles layer via `VITE_TSM_GOVERNMENT_PMTILES_MANIFEST` and `VITE_TSM_GOVERNMENT_PMTILES_URL`. It reads the published manifest, requires required metadata, and does not fabricate missing features. **The browser does not hash the entire remote PMTiles archive**; the release/ingestion process must check the archive against its SHA-256 before publishing. Existing MapLibre PMTiles support remains intact. The native Windows UE Shipping executable does not consume this web overlay without an independently built local snapshot adapter.

Execute `npm run build:uacf`, `npm run test:government-fabric`, `npm --prefix tsm-console run check:type`, and the main CI workflow after checkout. Passing CI alone does not verify agency service access, PostGIS deployment, 3D Tiles, Windows native packaging, or regulatory decisions.

Relevant primary documentation: https://sdmdataaccess.nrcs.usda.gov/webservicehelp.aspx ; https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer ; https://nld.sec.usace.army.mil/data-services/services/ ; https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_restmapservice.html ; https://docs.protomaps.com/pmtiles/create .
