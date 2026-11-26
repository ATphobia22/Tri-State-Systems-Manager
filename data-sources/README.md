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

## Posey County and Mount Vernon source evidence

The [Posey public-source manifest](manifests/posey-county-public-sources.json)
records the 15 source domains, publisher links, and the SHA-256 of each archived
file. It includes original TIGER/Line 2026 Posey road and water shapefiles, 2025
Mount Vernon place geometry, georeferenced 2023 IGIO imagery, 2025 USDA crop
classes, historical Indiana State Library map scans and Indiana framework
service receipts.

The 2026 archives are available for offline evaluation alongside the fixed 2024
inputs used by the regional screen and GeoPackage build. The compiler's
`read_tiger` now derives its source vintage from the canonical archive name
and rejects mismatched shapefile members to prevent 2026 records receiving 2024
identities. The two releases contain 3,024 and 2,817 Posey road records,
respectively. These counts describe source records and do not measure changes
in the physical road network.

The 2023 orthophoto sample is EPSG:2968 (NAD83 HARN / Indiana West, US survey
feet), with 1 ft export pixels from a 0.5 ft source. It covers a local Mount
Vernon window. The 2025 USDA export spans a Posey County bounding rectangle
and preserves categorical values using nearest-neighbor resampling. Neither
raster supplies NAVD88 elevations. Historical maps are contextual scans.

The official 2016–2020 IGIO footprint service returned 23,082 Posey records.
This count does not resolve the 267-record difference against the published
22,815-building inventory or verify roof and ground heights.

Verify only this acquisition from the repository root:

```sh
sed -n '/^## Posey County public sources/,$p' data-sources/SHA256SUMS | sha256sum -c -
```
