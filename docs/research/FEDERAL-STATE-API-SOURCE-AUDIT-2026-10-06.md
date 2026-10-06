# Federal/State API Source Audit — 2026-10-06

**Purpose:** classify every FEMA/USACE/Indiana data source by authority,
provenance, and runtime role — not as interchangeable "data".

**Method:** every endpoint below was fetched live on 2026-10-06. No endpoint
was recorded from documentation alone. Machine-readable manifest:
`data/acquisitions/federal-state-source-integration-2026-10-06.json`.

## Classification scale

`VERIFIED` → `PLANNED` → `SCHEMA_PENDING` → `UNVERIFIED` → `BLOCKED`

## Findings

### FEMA / OpenFEMA — VERIFIED
- Base `https://www.fema.gov/api/open` — public, read-only, **no key, no registration**.
- 50-dataset catalog pulled live; `data/fema/openfema-catalog.json` refreshed
  (was 8 datasets) with SHA-256 source integrity; 7 deprecated endpoints flagged.
- Verified working: DisasterDeclarationsSummaries (v2), FemaWebDeclarationAreas
  (v1; 5 Posey County records), NfipCommunityStatusBook (v1; 180209 participating,
  effective map 11/05/14), HMGP/PA summaries.
- **Not in OpenFEMA:** NFHL flood-hazard geometry stays on
  `hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` (already wired).

### USACE CWMS Data API — VERIFIED (optional plane)
- `https://cwms-data.usace.army.mil/cwms-data/` — public, no key.
- Verified: catalog/timeseries queries, Mt. Carmel stage series
  (`MtCarmel.Stage.Inst.15Minutes.0.USGS-rev`, 97 observed values),
  `/timeseries/recent` (latest 5.05 ft — dashboard-ready).
- **Runtime role:** optional USACE water-data plane. NOT a replacement for USGS
  observations or hydraulic-model results. Live fetch is caller-initiated only
  (project button-only live-data policy); `usace-cwms.mjs` has no polling.
- Caveat: generic "Wabash" CWMS location resolves upstream (Wabash, IN) —
  use MtCarmel / EVVI3 / OHIO_LD_52 series for the confluence.

### USACE National Levee Database (NLD2) — VERIFIED
- Current public API: `https://levees.sec.usace.army.mil/api` (155-path OpenAPI
  spec inspected). Public, read-only, no key.
- `tsm-console/server/ingestion/usace-nld.mjs` rewritten from the legacy
  `nld.sec.usace.army.mil/data-services` binding to NLD2. Legacy constant
  retained for reference only.
- Wabash Levee Unit 1 & 2 systems (270005000005/6) leveed-area polygons
  acquired to `data/usace-nld/leveed-areas-wabash-v1.geojson`; stored artifact
  SHA-256 is byte-identical to a live API smoke test.
- Per NLD docs: NAD83 horizontal, NAVD88 vertical. dataClass: evidence.
- Gap: `/coordinate-lookup` returns HTTP 500 (server-side); not depended on.

### USACE National Inventory of Dams — SCHEMA_PENDING
- Developer/Swagger endpoint reachable; public, no key. J.T. Myers (KY03060)
  and Newburgh (KY03059) inventory records verified.
- No adapter written until the actual Swagger schema is pinned — no invented
  field mappings.

### USACE National Structure Inventory — VERIFIED (reference only)
- Root `https://nsi.sec.usace.army.mil/nsiapi/`; `structures?fips=18129&fmt=fc`
  returns 15,551 Posey County structures (239 within ~5 km of anchor).
- **Classification:** consequence/structure reference data, NOT survey truth.
  Modeled/estimated attributes per USACE's own documentation.
- Acquisition script: `tools/acquisition/usace/fetch-nsi-structures.mjs`.

### Indiana DNR Water Wells — VERIFIED (quality-classified)
- `https://gisdata.in.gov/server/rest/services/Hosted/WaterWells_DNR_Water_IN_1/FeatureServer`
  (~407k records). Free, no key.
- Acquisition script classifies location quality per record:
  `field-located` / `geocoded` / `plss-estimated` / `unknown`.
- **Estimated well locations are never presented as survey-grade geometry.**

### IndianaMap / Indiana GIO — VERIFIED (discovery plane)
- 840-dataset DCAT inventory pulled. BAFM layer verified (1,093 Posey County
  features).
- **Authority rule:** BAFM is an Indiana DNR state product (`source_dnr=IDNR_ZONEA`);
  it is NEVER silently promoted to FEMA NFHL authority.

### Indiana IGA API — BLOCKED
- `https://docs.api.iga.in.gov/usage.html` returns HTTP 403. No schema, no
  endpoints, no adapter. Not fabricated.

## Deliberately excluded
AccuWeather, onX Offroad, to3D and similar connectors were not forced into
this fabric — they add dependencies without improving these data contracts.
