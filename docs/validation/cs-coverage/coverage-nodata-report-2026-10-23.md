# C/S Coverage & Nodata Report — 2026-10-23

Companion: `aoi-manifest-2026-10-23.json` (34 entries). Machine-readable twin: `coverage-nodata-report-2026-10-23.json`.
Branch: `feat/finish-technical-gaps-20261023`. Closes NOT-COMPLETE registry item 3 (2026-10-18) evidence requirement for an exact AOI manifest + coverage/nodata report.

## AOI

Ohio–Wabash confluence tri-state region — 8 counties:
Posey IN (18129), Vanderburgh IN (18163), Warrick IN (18173),
Henderson KY (21101), Union KY (21225), White IL (17193),
Wabash IL (17185), Gallatin IL (17059).

## Labels

- **VERIFIED** — SHA-256 re-verified against the source manifest on 2026-10-23 (this VM).
- **PROVISIONAL** — provider claim not re-verified live from this VM (egress proxy blocks live checks).
- **UNAVAILABLE** — missing from held sources; never zero-filled or interpolated.

Staleness (age from verification/acquisition timestamp to 2026-10-23): FRESH ≤ 30 d · STALE 31–90 d · EXPIRED > 90 d.

## Summary

| Class | VERIFIED | PROVISIONAL | UNAVAILABLE |
|---|---|---|---|
| Streaming sources (15) | 0 | 13 | 2 (noaa-nwps PROGRAM_PENDING, point-township-historical REQUIRES_DOWNLOAD) |
| Held NFHL snapshots | 8 (7 county clips + regional aggregate) | 0 | 1 (Wabash IL county clip) |
| Held SSURGO snapshots | 8 | 0 | 0 |
| Site rasters | 0 | 0 | 2 (registered, not materialized) |
| **Total (34)** | **16** | **13** | **5** |

County-clip coverage: **NFHL 7/8 AOI counties hash-verified; SSURGO 8/8 hash-verified.**

## Per-county matrix

| County | NFHL held clip | SSURGO held | IN state services | National streaming services |
|---|---|---|---|---|
| Posey IN 18129 | 1.0 VERIFIED (84 feat) | 1.0 VERIFIED | 1.0 PROVISIONAL | PROVISIONAL (provider claim) |
| Vanderburgh IN 18163 | 1.0 VERIFIED (830 feat) | 1.0 VERIFIED | 1.0 PROVISIONAL | PROVISIONAL |
| Warrick IN 18173 | 1.0 VERIFIED (43 feat) | 1.0 VERIFIED | 1.0 PROVISIONAL | PROVISIONAL |
| Henderson KY 21101 | 1.0 VERIFIED (633 feat) | 1.0 VERIFIED | 0.0 UNAVAILABLE | PROVISIONAL |
| Union KY 21225 | 1.0 VERIFIED (187 feat) | 1.0 VERIFIED | 0.0 UNAVAILABLE | PROVISIONAL |
| White IL 17193 | 1.0 VERIFIED (106 feat) | 1.0 VERIFIED | 0.0 UNAVAILABLE | PROVISIONAL |
| Wabash IL 17185 | 0.0 UNAVAILABLE (clip); 20 feat via aggregate | 1.0 VERIFIED | 0.0 UNAVAILABLE | PROVISIONAL |
| Gallatin IL 17059 | 1.0 VERIFIED (88 feat) | 1.0 VERIFIED | 0.0 UNAVAILABLE | PROVISIONAL |

## Staleness vs acquisition time (as of 2026-10-23)

- **Held SSURGO (8 zips)** — retrieved 2026-10-23 → age 0 d → **FRESH**, VERIFIED. Note: held, but the query adapter is pending per the source manifest (not yet queryable by the client).
- **Held NFHL (8 files)** — retrieved 2026-09-30 → age 23 d → **FRESH**, VERIFIED. Underlying product vintage is the 2026-03-03 Esri NFHL view (EXPIRED as product vintage; FRESH as held snapshot). Derived copy, not the regulatory FEMA service.
- **Tile-fabric verifications** — checkedAt 2026-09-14 → 39 d → **STALE** (10 assets); 2026-09-18/19 → 34–35 d → **STALE** (2 assets); 2026-09-28 → 25 d → **FRESH** (fema-effective, fema-nfhl-firmette).
- **Site rasters (terrain, orthophoto)** — acquisition year 2020 → **EXPIRED** as product vintage, and **UNAVAILABLE** as held assets (no `asset-download-manifest.json` materialized; live endpoints only).

## Nodata regions (explicit — never interpolated)

1. **Wabash County IL (17185)** — no dedicated NFHL county clip in `nfhl-holdings-manifest.json` or `~/workspace/offline-data` → **UNAVAILABLE** as a clip. Partial fallback: 20 features of DFIRM 17185C inside the regional aggregate `nfhl-flood-zones-8county.geojson` (hash-verified).
2. **Henderson KY, Union KY, White IL, Wabash IL, Gallatin IL** — Indiana-scoped fabric services (BAFM, parcels, imagery, 2016–2020 elevation, building footprints) provide no coverage → **UNAVAILABLE**; no KY/IL counterparts registered in the fabric.
3. **NOAA NWPS forecast tile** — PROGRAM_PENDING → **UNAVAILABLE**.
4. **Posey terrain / orthophoto rasters** — registered in `site-asset-manifest.ts`, not materialized → **UNAVAILABLE** as held assets (live service endpoints remain).
5. **Historical Point Township scan** — REQUIRES_DOWNLOAD → **UNAVAILABLE**.
6. **SSURGO** — held and hash-verified, but not yet queryable by the spatial stack (adapter pending) → present, not yet serving.

## Held-file provenance measured 2026-10-23

- NFHL GeoJSONs: coordinates in decimal degrees → **EPSG:4326** (observed). Vertical datum: per-feature `V_DATUM`; sampled 400 features of the regional aggregate — 13 declare NAVD88, the rest blank → **do not assume a single datum**.
- SSURGO zips: `GCS_WGS_1984` (**EPSG:4326**) per `.prj` inside `soil_IN129.zip`; vertical datum NOT_APPLICABLE (soil polygons).
- All 16 held-file SHA-256 recomputations matched their manifest claims exactly.

## State-machine note

`TileResourceLifecycle` statuses exercised by the deterministic suite in `tsm-console/tests/tile-lifecycle-provider-transitions.test.ts`. The `stale` status had no producer; `markStale()` was added (resilient: staleness labels the record, never gates fetching). Unreachable without a live provider: automatic time-driven staleness (no internal clock — the caller evaluates acquisition time with an injected clock) and provider-initiated `fetching→ready/failed` completions (the lifecycle never fetches; the bridge/fetch layer drives those transitions). Full matrix documented in the test file header.
