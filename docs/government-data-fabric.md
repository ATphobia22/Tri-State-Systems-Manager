# TSM Government Data Fabric

Government data is a first-class, provenance-tracked capability fabric — not a
collection of ad hoc APIs. Package: `@tsm-uacf/government`
(`packages/government/`). Tests: `npm run test:government-fabric` (fully
offline). Typecheck: `npm run build:uacf`.

## Architecture

```
Government Source
      │
      ▼
Source Adapter (REST allowlisted, fetcher-injectable; live = user-initiated only)
      │
      ▼
Pinned snapshots (packages/government/snapshots/, SHA-256 verified) ── default/offline path
      │
      ▼
Metadata Validator → Schema Validator → Hash Generator
      │
      ▼
Evidence Registry (deterministic attestation chain: metadata → feature → dataset → evidence → attestation)
      │
      ▼
Local holdings reader (hash-verified against manifests; data lives outside git)
      │
      ▼
Capability providers (geo.nfhl.query, river.gauge.query, river.iv.query, source.fetch/validate/hash/register)
      │
      ▼
MapLibre / Digital Twin
```

## Source registries

Two registries, kept in sync by tests:

- `src/GovernmentSourceRegistry.ts` — 22 dot-id sources (`fema.nfhl`,
  `noaa.nwps`, `usgs.nwis`, …) with authority levels, access modes, and honest
  `limitations` per source.
- `src/index.ts` — 19 dash-id REST sources backing `queryGovernmentJson`
  (origin-allowlisted HTTPS fetch → `EvidenceEnvelope` with SHA-256 hashes).
- `src/capabilities.ts` — capability statuses: `registered` (adapter exists)
  vs `discovery-only` (not yet wired).

## Live-fetch policy

Standing rule: live government fetches are **user-initiated only** — no
polling, no background refresh, no scheduled live-network CI jobs. The default
path serves pinned, hash-verified snapshots. `queryGovernmentJson` accepts an
injected `fetcher` so every adapter is testable fully offline.

## Done-state checklist (honest, 2026-10-23)

| Item | State | Evidence / blocker |
|------|-------|--------------------|
| FEMA NFHL integrated | ✅ Operational | `geo.nfhl.query` capability + `FemaAdapter`; 32-layer canonical registry (`packages/geo`, `nfhl:validate` CLI, opt-in live drift check); local flood-zone GeoJSONs served hash-verified via `getLocalFloodZones` when the offline bundle is mounted (`TSM_OFFLINE_DATA_ROOT`) |
| USGS 3DEP integrated | ✅ Operational | `UsgsAdapter.getMetadata` + `geo.dem.query` registered; 5.9 MB screening DEM clip held in `~/workspace/gov-data-downloads/` |
| USGS water data integrated | ✅ Operational | `NwisAdapter` (JSON IV live, user-initiated) + `NwpsAdapter` (gauge + stageflow live, user-initiated); pinned snapshots for 4 tri-state gauges + 5-gage site metadata bundled in `packages/government/snapshots/`; `river.gauge.query` + `river.iv.query` registered |
| NOAA integrated | ✅ Operational | `NoaaAdapter` (api.weather.gov) + `weather.forecast` registered; NWPS gauges wired (above); tides/storm-surge remain `discovery-only` (no adapter yet) |
| Census integrated | ⚠️ Discovery-only | Registry + `census.lookup` / `census.boundary.query` declared; TIGER 2024 county ZIP held chunked in repo (`data/fabrics/`); no live adapter yet |
| EPA integrated | ⚠️ Discovery-only | Registry entries only; no adapter yet |
| USDA integrated | ⚠️ Partial | Registry entries only; **SSURGO download attempt in progress** — SoilGrids v2.0 REST remains the honest operational substitute until SSURGO lands |
| Indiana DNR BAFM | ✅ Operational (state product) | ArcGIS REST wired; 75 MB Posey floodplain chunks in repo; BAFM is labeled BAFM, never promoted to FEMA authority |
| PostGIS operational | ⚠️ Optional | Parcel + NFHL table schemas and migrations exist; ingestion pipeline is storage-agnostic (PostGIS when configured, local fallback for air-gapped) |
| MapLibre operational | ✅ Operational | Console basemap + flood layers (pre-existing) |
| Evidence ledger operational | ✅ Operational | Deterministic attestation chain (`src/ingestion.ts`), snapshot manifests, `validateEvidenceEnvelope` |
| Provenance operational | ✅ Operational | Every envelope carries traceId, SHA-256 hashes, citations, retrieval timestamps |
| Research engine operational | ✅ Operational | `packages/research` government-research-fabric (pre-existing) |
| Digital twin operational | ⚠️ Partial | Transvoxel/mesh pipeline green; full twin assembly per NOT-COMPLETE registry |
| Hydrology operational | ⚠️ Partial | USGS/NWPS/GEOGloWS wired; **HEC-RAS/ras2fim execution investigation in progress** (docker `noaaowp/ras2fim` viability); `ras2fim_tristate.py` reports honest UNAVAILABLE until execution is proven |
| TimesFM nowcasting | ⚠️ Blocked, investigating | **PyTorch install retry in progress** through the egress proxy |
| Air-gapped mode operational | ✅ Operational | All fabric tests pass fully offline; snapshots + local holdings need no network |
| CI/CD operational | ✅ Operational | `test:government-fabric` in `verify:uacf`; contract validator green; `nfhl:validate` stays an explicit opt-in command (no scheduled live jobs) |
| Security controls operational | ✅ Operational | HTTPS-only, origin allowlisting, no credentials in code, input validation on all adapters |

**Not started / honestly out of scope for this pass:** DOT NBI adapter,
Army Corps NLD REST (public API 404s — no auth attempted), KYEM/IL-EMA pages
(403 from this network), FEMA NFHL live MapServer from this VM (egress-proxy
block; NFHL data held via Esri-derived copy + BAFM).

## Key invariants

- Never fabricate: missing data is reported with the exact blocker, never
  invented. `wrapPinnedSnapshot` and the local-holdings reader verify SHA-256
  before serving; mismatches throw.
- Resilient, never blocking: validators return `{valid, provisional,
  warnings}`; unavailable steps report and continue.
- Authority honesty: FEMA NFHL effective ≠ preliminary/pending/draft; Indiana
  DNR BAFM is a separate state product; NWM analysis ≠ forecast; HEC-RAS
  outputs carry model/software version.
- No AWS, no Cesium, no PE/certification language, no submissions.
