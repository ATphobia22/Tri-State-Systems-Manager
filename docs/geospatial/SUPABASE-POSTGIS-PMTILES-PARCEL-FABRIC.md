# Supabase PostGIS + PMTiles parcel fabric

**Status:** implementation-ready code is committed on this branch; cloud activation is not certified. The connected Supabase projects **supabase-amber-island** and **TuckerConsoleDb** were both reported **INACTIVE** on 2026-10-19. No project was restored or modified by this change, and no parcel rows were uploaded.

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

1. Restore the intended Supabase project only after confirming the correct project and current billing/plan status. The connected projects were inactive during implementation.
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

Tippecanoe supports PMTiles output directly (no intermediate MBTiles conversion is required). The builder uses \`--drop-densest-as-needed\` for tile-size safety; if legal/engineering workflows require every feature at a specific zoom, validate tile contents and use a zoom-specific export/partition rather than assuming \`--drop-rate=0\` is universally safe.

## Source references

- Supabase PostGIS and bounding-box queries: https://supabase.com/docs/guides/database/extensions/postgis
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database function security: https://supabase.com/docs/guides/database/functions
- PMTiles concepts / HTTP Range: https://docs.protomaps.com/pmtiles/
- PMTiles for MapLibre: https://docs.protomaps.com/pmtiles/maplibre
- Tippecanoe output and zoom controls: https://github.com/felt/tippecanoe/blob/main/README.md
