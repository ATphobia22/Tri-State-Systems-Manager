# Authoritative Context & Real-Time Data Fabrics — 2026-10-24

## Problem addressed

Loaders and map twin could lack a single place that lists **missing context or authoritative inputs**, while real-time government fabrics were already ingested server-side. Gaps were easy to treat as silent nulls.

## Fix

1. **`src/lib/authoritative-context.ts`**
   - `getAuthoritativeContextSnapshot()` — site, FIRM SSOT, gage datums, fabric counts, structured **gaps**
   - `REALTIME_FABRIC_REFS` — USGS IV/OGC, NOAA NWPS, FEMA NFHL, 3DEP, NWS points
   - `formatContextGapsForUi()` — Trust Fabric / stage banners
   - Severities: `info` | `warning` | `blocking_for_regulatory`
   - Never invents BFE, flood categories, or gage-zero NAVD88 conversion

2. **`src/lib/stage.ts`**
   - On live hydrologic **unavailable**, sets `qualifier` to `missing_live_stage` plus gap summary (truncated)
   - Still returns null `value_ft` — no fabricated stage

3. **Existing**
   - `data-fabric-registry.ts` — all fabrics `implemented: true`; `assertFabricRegistryComplete()`
   - Server ingestion + `contracts/registries/tsm-real-world-data-fabric-registry-v1.json` (10/10 LIVE probe)
   - `scripts/geospatial/probe-data-fabrics.mjs`

## Known explicit gaps (honest, not bugs)

| Gap | Severity |
|-----|----------|
| Legacy scenario elevation evidence | blocking_for_regulatory |
| SITE vertical datum UNVERIFIED | blocking_for_regulatory |
| NWS category thresholds null in SITE | warning |
| Gage-zero conversion not published for 03378500 | info |
| Alternate FIRM panel PENDING_MSC_VERIFY | info |

`allAuthoritativeInputsPresent` is **false** until project survey evidence and verified vertical datum are supplied — by design.

## Test

```bash
node --test tsm-console/tests/authoritative-context-contract.test.mjs
```

Human authority remains final.
