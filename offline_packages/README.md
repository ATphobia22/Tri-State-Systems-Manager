# Offline Package Registry

Air-gapped dataset staging area. Every package directory holds vendored
data plus a `manifest.json` describing provenance. Nothing here is fetched
at runtime; the Unreal/native pipeline consumes only what is staged.

Layout:

```text
offline_packages/
├── lidar/         LAS/LAZ tiles (e.g. IN 3DEP 2020)
├── imagery/       NAIP / orthophoto
├── fema/         FIRM panels, NFHL extracts
├── usgs/         3DEP DEM, national map products
├── noaa/         NOAA forecast/observation products
├── simulations/  HEC-RAS / MODFLOW / SWMM inputs and staged outputs
└── evidence/     evidence packages with SHA-256 manifests
```

Manifest contract (`manifest.json` per package):

```json
{
  "package": "IN_3DEP_2020",
  "sha256": "<64 lowercase hex of the package payload>",
  "source": "USGS",
  "datum": "NAVD88",
  "verified": true
}
```

Rules:

- `sha256` is the genuine SHA-256 of the payload (see `TSMCrypto`; never MD5).
- `verified: true` only after an independent re-hash matches the manifest.
- `datum` records the source vertical datum as published; `null` when unverified.
- Packages are reference/screening data unless their manifest says otherwise.
- On import, TSMImport registers the package in the PostGIS `dataset_registry`
  (`ops/postgis/migrations/20260929_dataset_registry.sql`).
