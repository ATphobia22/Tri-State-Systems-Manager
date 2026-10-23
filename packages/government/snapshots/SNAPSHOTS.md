# Pinned government-data snapshots

Hash-verified, offline-servable copies of real government API responses held by
TSM. Served by `src/snapshots.ts` (`loadPinnedSnapshot`) when live fetch is
unavailable or not user-initiated. Every file is SHA-256 verified against
`manifest.json` before serving — a mismatch throws `SNAPSHOT_HASH_MISMATCH`.

| File | Source | Retrieved (UTC) | Bytes |
|------|--------|-----------------|-------|
| nws-nwps-mtvi3.json | api.water.noaa.gov/nwps/v1/gauges/MTVI3 | 2026-10-23T14:12:45Z | 33000 |
| nws-nwps-shni2.json | api.water.noaa.gov/nwps/v1/gauges/SHNI2 | 2026-10-23T14:12:45Z | 47008 |
| nws-nwps-nhri3.json | api.water.noaa.gov/nwps/v1/gauges/NHRI3 | 2026-10-23T14:12:45Z | 26114 |
| nws-nwps-evvi3.json | api.water.noaa.gov/nwps/v1/gauges/EVVI3 | 2026-10-23T14:12:45Z | 42149 |
| nws-nwps-mtvi3-stageflow.json | api.water.noaa.gov/nwps/v1/gauges/MTVI3/stageflow | 2026-10-23T19:36:00Z | 3898 |
| usgs-5gage-sites.json | waterservices.usgs.gov/nwis/site/ (5 gages, RDB converted) | 2026-10-23T14:12:45Z | 1511 |
| nfhl-holdings-manifest.json | manifest only (data files live outside git) | 2026-09-30 | 8691 |

`nfhl-holdings-manifest.json` is a copy of
`data/acquisitions/offline-bundle-20261001/manifest-nfhl.json`: it describes
the NFHL flood-zone GeoJSONs (Esri-derived copy, vintage 2026-03-03) held in
the local offline bundle (`~/workspace/offline-data/`). The data files are NOT
in git (large-data policy); `src/localHoldings.ts` resolves them against an
explicit data root and hash-verifies each file before serving.

Full acquisition provenance (URLs, access dates, HTTP status, per-item notes):
`~/workspace/gov-data-downloads/manifest.json`.
