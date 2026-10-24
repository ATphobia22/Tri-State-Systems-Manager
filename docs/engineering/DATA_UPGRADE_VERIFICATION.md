# Data-Upgrade Verification Record (2026-10-24)

Verification of the pasted "state-of-the-art upgrades" material against live
sources. Each claim: VERIFIED / CORRECTED / REJECTED, with what was actually
confirmed. Anything not verified here is NOT implemented as a data layer.

## Overture Maps buildings — CORRECTED, sample pulled

- Real path: `s3://overturemaps-us-west-2/release/<RELEASE>/theme=buildings/type=building/*.parquet`
  (dated release, e.g. `2026-09-23.0`; the pasted `release/latest` does not
  exist). Anonymous read confirmed (`--no-sign-request` equivalent).
- Schema has optional `height` (m), `roof_shape`, `roof_height` — but all
  are optional and often null.
- **Sample pulled 2026-10-24** (DuckDB 2.0.0 over anonymous S3, bbox
  −88.5..−87.0 / 37.5..38.5, LIMIT 2000):
  `~/workspace/offline-data/overture-tristate-20261024/overture_tristate_sample.csv`
  (609,167 bytes, SHA-256 in `manifest.json`): 2,000 buildings, 443 with a
  height value (22%). Rows are file-order first 2000, so the sample skews
  west/south — it is NOT a representative 8-county extract. A full extract
  is a separate job (512 part files, ~500 MB each).
- VM note: DuckDB httpfs cannot parse a credential-bearing proxy URL from
  the environment; scrub the env vars and set split `http_proxy` /
  `http_proxy_username` / `http_proxy_password` inside DuckDB before
  installing httpfs.

## USGS 3DEP lidar — CORRECTED

- `usgs-lidar-public` is **Entwine Point Tiles (EPT), not COPC**
  (`<PROJECT>/ept.json`, anonymous). The companion `usgs-lidar` bucket is
  raw LAZ and **requester-pays — do not touch without user decision**.
- COPC lives on the Microsoft Planetary Computer 3DEP collection
  (Azure-hosted), not this AWS bucket. Do not code an AWS COPC reader
  against `usgs-lidar-public`.

## FEMA Base Level Engineering, Posey County — NOT CONFIRMED

- BLE itself is real (USGS-built EstBFE viewer serves engineering models,
  depth grids, WSE for green/downloadable status areas by HUC), but it is
  NOT the FEMA Map Service Center, and **no source lists Posey County as
  BLE-covered**. No Posey BLE model/depth/WSE file was found.
- Status: **unavailable until checked county-by-county in the EstBFE
  viewer**. Not implemented as a layer. Indiana's separate product is INFIP,
  not BLE.

## GEOGloWS ECMWF Streamflow Service v2 — VERIFIED (pattern)

- Pattern `https://geoglows.ecmwf.int/api/v2/<data-product>/<reach-id>`,
  global reach network (6–7M reaches), free without login. Newer v2 data
  also in anonymous S3 Zarr (`s3://geoglows-v2/…`).
- **Not implemented yet**: no Ohio/Wabash reach ID was resolved in this
  pass, so no live tri-state response was tested. Reach lookup is an open
  item; do not hardcode an example reach ID as a tri-state reach.

## NOAA NextGen Hydrofabric VPU 05 — VERIFIED (publisher corrected)

- VPU 05 = Ohio drainage area (EPA NHDPlus). Publisher is **NOAA Office of
  Water Prediction via Lynker Spatial** (`s3://lynker-spatial/hydrofabric/v2.2/…`),
  not CUAHSI. CONUS-level GeoPackages confirmed on the bucket
  (`conus_nextgen.gpkg` etc.). VPU-05-specific files go through the
  documented per-VPU accessor; not pulled in this pass.

## PMTiles v3 — VERIFIED (format/tooling only)

- PMTiles v3 is a real single-file archive read via HTTP range requests;
  official CLI is `pmtiles convert` (MBTiles→PMTiles). "No server" means
  no tile server, not no HTTP host — a static host serving `Range`
  requests is still required. No conversion was performed (no MBTiles
  source was in scope for this pass).

## NGS NSRS modernization — IN PROGRESS, not official

- NATRF2022 / NAPGD2022: declared stable 2026-05-28, public beta tools
  2026-09-15, testing ≥ 6 months, FGCS approval + official transition
  planned 2027 (no fixed date). **NAD83(2011) / NAVD88 remain official.**
  No datum migration is implemented; `scripts/validation/verify_datums.py`
  work, if any, must stay on the current official datums with the beta
  noted, never adopted as authoritative.

## USGS 3DEP STAC — CORRECTED

- The public STAC API is **Microsoft's**
  (`https://planetarycomputer.microsoft.com/api/stac/v1`, `3dep-lidar`
  group: COPC + COGs), not USGS's (USGS's own STAC endpoint in training
  material is Landsat). Caveat: the Planetary Computer 3DEP collection is
  a late-2022 snapshot — verify vintage per tile before treating it as
  current 3DEP.

## Regulatory / IDTA verification (verified 2026-10-24)

- Illinois Part 3700 §3700.20: 0.1 ft floodway screen — VERIFIED (ILGA
  text), with §3700.70 bridge/culvert exceptions noted in
  `SCIENTIFIC_VALIDATION.md`.
- Kentucky 401 KAR 4:060: §4 no-impact rule for encroachments VERIFIED,
  alongside the separate §1/§5 1.0 ft floodway-boundary criterion.
- Indiana IC 14-28-1 as the Flood Control Act authority behind 312 IAC 10
  — VERIFIED (312 IAC 10-1-2 header).
- IDTA templates: all pasted IDs verified against IDTA's hub except
  corrections — 02015 = Type / 02016 = Instance (02017 is Asset Interfaces
  Description), 02011-1 for Hierarchical Structures, full titles for 02045
  and 02053, 02002 legacy/unconfirmed. Registry (types only):
  `packages/ontology/src/idta-submodel-templates.ts`.
- OpenMI 2.0 (OGC 11-014r3): dormant, C#/Java-only spec, no successor
  since the 2014 adoption (spec dated 2010). CSDMS BMI + PyMT verified as
  the Python-supported coupling path. For TSM: do not build on OpenMI in
  Python; evaluate BMI if coupling is ever needed.
- AAS: IEC 63278-1:2023 (IEC TC 65/WG 24 owns the standard; IDTA stewards
  the template ecosystem).
- Only verified rules are encoded in
  `backend/governance/archimedes_engine.py`; see
  `docs/regulatory/312-IAC-10-VERIFIED-RULES.md` for the Indiana record.
