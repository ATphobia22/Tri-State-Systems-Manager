# Supabase PostGIS + PMTiles parcel fabric

**Status:** implementation-ready code is committed on this branch; cloud activation is not certified. Live inspection on 2026-10-19 found **supabase-amber-island** `INACTIVE` and **TuckerConsoleDb** `ACTIVE_HEALTHY`, with no public tables or migration history in TuckerConsoleDb. No project was restored or modified by this change, and no parcel rows were uploaded. The correct deployment target still requires owner confirmation; active status alone does not establish that TuckerConsoleDb is the intended production project.

## Design

- **PostGIS RPC (dynamic):** the optional MapLibre overlay queries only the current viewport after \`moveend\`, only at zoom 13+, with a 250 ms debounce, an abortable request, a 2-degree maximum bbox, and a 1,000-feature response cap. The API returns only public-safe parcel identifiers and source lineage. It does not return owner names.
- **PMTiles (static):** Tippecanoe writes \`.pmtiles\` directly. PMTiles archives are immutable and are read through HTTP Range requests; publish only verified, licensed datasets with source attribution and a manifest. The dynamic RPC is for interactive lookup, not a substitute for versioned tile products.
- **Fail-closed behavior:** absent public Supabase configuration disables the dynamic overlay. HTTP errors clear the overlay rather than presenting stale parcels as current. No service-role secret belongs in browser environment variables.
- **Data truth:** the SQL schema requires source IDs, source record IDs, validity checks, and explicit \`is_public = true\`. The schema intentionally excludes owner names and unverified zoning fields. It does not imply a survey, parcel title determination, hydrologic AOI approval, or flood-model output.

## Repository changes

- \`supabase/migrations/20261019143000_posey_parcel_bbox.sql\` creates the PostGIS table, GiST index, RLS policy, and bounded \`get_parcels_in_bbox\` RPC.
- \`tsm-console/src/lib/supabase-parcel-bbox.ts\` implements the configured-only MapLibre client.
- \`tsm-console/src/components/RealWorldTwinMap.tsx\` attaches the optional layer.
- \`scripts/geospatial/build_pmtiles.py\` emits PMTiles directly and honors the exact \`--output\` path.
- Tests cover SQL security contracts and direct PMTiles output behavior.

## Required configuration

Set these **public** build-time variables only after the database migration and dataset import are validated:

- \`VITE_SUPABASE_URL=https://<project-ref>.supabase.co\`
- \`VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...\` (or a legacy anon key)

These values are public-client credentials. Never set \`VITE_SUPABASE_SERVICE_ROLE_KEY\` or any secret key.

## Activation checklist

1. Confirm which Supabase project is the authorized deployment target. `TuckerConsoleDb` is currently `ACTIVE_HEALTHY` but has no public tables or migration history; `supabase-amber-island` is `INACTIVE`. Do not restore or mutate the inactive project without explicit target confirmation.
2. Enable PostGIS in the \`extensions\` schema, apply the committed migration, and run Supabase security/performance advisors.
3. Import only the authoritative Posey County parcel dataset after validating its license, source date, CRS, geometry validity, stable parcel identifier, and row count. Normalize polygon geometries to \`MultiPolygon, EPSG:4326\`; retain source record IDs and timestamps. Do not import owner names.
4. Test RLS and RPC behavior for anonymous and authenticated roles, including invalid/reversed/oversized bounds, zero matches, 1,000 matches, truncation, and spatial intersection correctness.
5. Configure the public URL and publishable key in the deployment environment; run the production build and a live browser smoke test at zoom 13+.
6. Generate PMTiles only from verified input. Confirm archive metadata, source layer name, attribution, min/max zoom, nonzero archive size, HTTP 206 Range responses, CORS for the deployed origin, and successful rendering in MapLibre.
7. Update the geospatial tile manifest only after the artifact is hosted and tested. Do not mark a not-yet-generated parcel archive as published.

## Build a static PMTiles archive

\`\`\`bash
python3 scripts/geospatial/build_pmtiles.py \\
  --input /path/to/validated-parcels.geojson \\
  --output tsm-console/public/data/pmtiles/posey-parcels.pmtiles \\
  --name posey-parcels --minzoom 13 --maxzoom 17
\`\`\`

Tippecanoe supports PMTiles output directly (no intermediate MBTiles conversion is required). The preconfigured building-display profile opts into `--drop-densest-as-needed` plus zoom extension for tile-size safety. The custom-input path does **not** enable feature dropping by default, so parcel/building records are not intentionally discarded by the builder. Validate tile-size limits and decoded feature counts at each required zoom; if a display-only profile must simplify/drop features, make that lossy policy explicit in the layer configuration and never use the generalized archive as a complete legal/engineering parcel inventory.

## Parcel source acquisition and licensing gate

The Indiana Geographic Information Office announced that the **2025 Data Harvest parcel boundaries** are available through the Indiana GIS Data Harvest portal and IndianaMap (release notice dated 2025-12-18): [official release notice](https://www.in.gov/gis/geoinsights/posts/data-releases-data-harvest-2025-and-imagery/) and [Parcel Boundaries of Indiana 2025 dataset page](https://www.indianamap.org/datasets/INMap%3A%3Aparcel-boundaries-of-indiana-2025/about).

The [Posey County WTHGIS viewer](https://poseyin.wthgis.com/) is a useful local reference, but its published disclaimer says mapped information is not warranted and must not be used as a legal description. Do not treat the viewer alone as evidence that bulk redistribution is licensed.

**Activation gate:** inspect the 2025 dataset's license/terms and item metadata, verify Posey County coverage and data vintage, record the exact source URL, item ID, update date, license text, attribution, CRS, geometry type, and feature count, then validate geometry and lineage. Until that review is captured in the source manifest, do not bulk-load or publicly redistribute the data. The database schema intentionally defaults records to `verification_status='pending'` and `is_public=false`.

## Source references

- Supabase PostGIS and bounding-box queries: https://supabase.com/docs/guides/database/extensions/postgis
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database function security: https://supabase.com/docs/guides/database/functions
- PMTiles concepts / HTTP Range: https://docs.protomaps.com/pmtiles/
- PMTiles for MapLibre: https://docs.protomaps.com/pmtiles/maplibre
- Tippecanoe output and zoom controls: https://github.com/felt/tippecanoe/blob/main/README.md
