# Real-World Data Fabric Audit — 2026-10-24

**Policy:** Technology informs people; it does not silently govern people. Human authority remains final.  
**Registry:** `contracts/registries/tsm-real-world-data-fabric-registry-v1.json`  
**Probe:** `node scripts/geospatial/probe-data-fabrics.mjs`

## Audit result

Live probe of **10/10** primary government endpoints returned HTTP 200 (2026-10-24):

| Fabric ID | Authority | Role | Ingest |
|-----------|-----------|------|--------|
| usgs-nwis-iv | USGS | Gage IV (03378500) | `usgs-nwis.mjs` |
| usgs-ogc-latest-continuous | USGS | OGC latest continuous | `usgs-nwis.mjs` |
| noaa-nwps-api | NOAA/NWS | NWPS gauge MTVI3 | `noaa-nwps.mjs` |
| fema-nfhl-mapserver | FEMA | NFHL MapServer | `fema-nfhl.mjs` |
| usgs-3dep-elevation | USGS | 3DEP ImageServer | `usgs-tnm.mjs` |
| usgs-tnm-access | USGS | TNM product API | `usgs-tnm.mjs` |
| igio-parcels-current | Indiana GIO | Parcels FeatureServer | `indiana-gis.mjs` |
| igio-buildings | Indiana GIO | Building footprints | `indiana-gis.mjs` |
| usace-nid-arcgis | USACE | NID FeatureServer | `usace-nld.mjs` |
| nws-api-points | NWS | api.weather.gov points | `nws-weather.mjs` |

## Wiring (already present)

| Layer | Path |
|-------|------|
| Source allow-list + origin check | `source-fabric.mjs` + `source-contracts.mjs` |
| Client stage (USGS-first via API) | `src/lib/stage.ts` |
| Gage datums (explicit vertical) | `src/lib/gage-datums.ts` |
| NFHL priority layers | 28 / 27 / 16 / 23 / 34 / 3 / 22 / 32 |
| Indiana catalog | `tsm-indiana-data-catalog-v1.1` |
| Authority registry | `tsm-authority-registry-v35` |
| River network API | `river-network-api.mjs` |
| Provenance | `data-fabric-provenance.mjs` |

## Rules locked

1. Browser does **not** call legacy waterservices directly for production stage; uses TSM hydrologic API.  
2. Reject NOAA sentinel values (−999 / obs_not_current).  
3. Gage height remains **GAGE_DATUM** unless validated gage-zero NAVD88 is documented.  
4. NFHL geometry is **informational** until human decision records.  
5. H3 cell IDs preferred for aggregation keys; not FEMA boundaries.

## Operator actions (not auto-closed)

- GATED_OPERATOR secrets remain human-only.  
- LOMA case package binary PDFs need local push if not on remote.  
- Sparse 3DEP PNG tiles on GitHub Pages are coverage limits, not fabric outage.

## Finish note

Code-side fabric wiring is complete for the Tri-State primary set. Re-run `probe-data-fabrics.mjs` in CI or before release to refresh LIVE/DEGRADED status.
