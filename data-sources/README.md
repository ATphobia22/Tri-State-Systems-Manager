# data-sources/ — authoritative source evidence layer

**Purpose.** Machine-readable provenance for every authoritative data source vendored in
(or referenced by) this repository: what it is, who publishes it, where it came from,
when it was accessed, under what terms, whether it is downloaded or merely referenced,
and the SHA-256 of every committed file.

**Relationship to existing registries.** This directory does not replace them:

| Existing record | Role |
|---|---|
| `data/acquisitions/tsm-authoritative-source-manifest-v1.json` | Service-level source registry (endpoint URLs, authority classes) |
| `data/registries/fema-firm-panel-registry-v1.json` | FIRM panel validation targets |
| `data/posey-county/authoritative-source-vintage-v1.json` | Source vintage records |
| `tsm-console/src/lib/firm-panel-ssot.ts` | FIRM panel single source of truth (frontend) |

`data-sources/` adds what those lack: **per-source acquisition manifests with access dates
and license terms**, a **SHA-256 inventory of committed data files**, and a **canonical
CRS/vertical-datum record**.

## Contents

- `manifests/` — one JSON manifest per authoritative source:
  - `usgs-3dep-terrain.json` — USGS 3DEP 1/3-arc-second → Terrain-RGB tile pyramid (478 tiles, z8–z12)
  - `posey-parcels-xsoft.json` — Posey County parcels via XSoft ArcGIS (4,121 features)
  - `usgs-streamgages.json` — USGS Water Services 03378500 (New Harmony, IN) + 03377500 (Mt. Carmel, IL)
  - `fema-nfhl-firm.json` — FEMA NFHL/FIRM panels for FIPS 18129 (CID 180209)
  - `indiana-dem-2020.json` — Indiana statewide 2020 DEM tile index (581 tiles, referenced)
  - `posey-boundaries-tiger.json` — Posey County TIGER/Line boundary
- `SHA256SUMS` — SHA-256 of every committed data file (491 entries). Verify with
  `sha256sum -c data-sources/SHA256SUMS` from the repo root.
- `crs-datum-metadata.json` — canonical horizontal-CRS and vertical-datum record per source,
  plus the critical distinctions (352.67 gage-zero vs 352.71 site altitude; discharge vs WSE;
  Ohio River Datum vs NAVD88).

## Conventions

- Every claim in a manifest must be verifiable from the repo (file, commit, or cited record).
- Missing = unavailable. Never zero, never invented.
- A reprojection is not a vertical datum conversion unless the transformation is explicitly recorded.
- Global `backend/gov/site_constants.py` sentinels (`SOURCE_REQUIRED`) are intentional
  fail-closed defaults; source-specific values live in per-source records, never as globals.
