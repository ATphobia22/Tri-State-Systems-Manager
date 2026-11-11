# Public Evidence Time Machine, Uncertainty Lens and Parcel Passport — 2026-11-11

## Purpose and scope

TSM can publish inspectable public-interest scientific source evidence **without requiring its Unreal Engine application to be running**. This contribution provides a Python-standard-library-only snapshot integrity audit, change history, and informational parcel evidence passport.

- Program: `scripts/public_interest/evidence_kit.py`
- Regression tests: `scripts/public_interest/test_evidence_kit.py`
- CI: `.github/workflows/public-evidence-kit.yml`

**Not provided:** survey certification, parcel-specific flood risk determinations, hydraulic model calibration, spatial joins, or Unreal Engine Win64 Shipping binaries.

The existing source manifest `data/acquisitions/tsm-authoritative-source-manifest-v1.json`, historical acquisitions, engineering evidence ledger, and native-data SHA manifests remain authoritative for their own purposes. This format is a portable reference/evidence view, not a replacement.

## Core assurances

1. Each source declared `BYTES_VERIFIED` must exist locally under the snapshot root, without symlink/traversal, and must match an explicitly recorded SHA-256. A verified hash authenticates *local bytes*, not the external agency, model, parcel geometry, or interpretation.
2. Missing sources are represented by `SOURCE_UNAVAILABLE` or `NOT_EVIDENCED` — never invented elevations, water levels, building heights, or flood zones.
3. Historical differences report changes in source bytes or metadata, not a claim that a property's physical state changed.
4. Reports include only whitelisted parcel IDs, FIPS, supplied facts and source links. Owner names, supplied owner addresses and contact information are not exported. HTML is static, script-free, escaped, and usable offline.

## Input snapshot

Make a directory containing `snapshot.json` plus any data files. This record is deliberately `NOT_EVIDENCED`: it is an *example*, not an assertion that USGS data is unavailable.

```json
{
  "schema": "tsm.public-evidence.snapshot.v1",
  "snapshotId": "example-2026-11-11",
  "capturedAt": "2026-11-11T08:00:00Z",
  "sources": [
    {
      "sourceId": "usgs-waterdata",
      "sourceUrl": "https://api.waterdata.usgs.gov/ogcapi/v1/",
      "agency": "USGS Water Mission Area",
      "dataRole": "OBSERVATION",
      "status": "NOT_EVIDENCED",
      "assetPath": null,
      "sha256": null,
      "horizontalCrs": null,
      "verticalDatum": null,
      "units": null,
      "retrievedAt": null,
      "acquisitionDate": null,
      "publicationDate": null,
      "serviceLayerId": null,
      "license": null
    }
  ]
}
```

Only use `BYTES_VERIFIED` after actual data acquisition, recording a relative `assetPath`, retrieval time and *computed* SHA-256. The standalone verifier bounds an individual asset at 2 GiB; larger datasets belong to TSM's separate chunked native-data integrity pipeline. Large raw datasets are not suitable for normal Git history.

## Offline commands

```bash
python3 scripts/public_interest/evidence_kit.py audit ./snapshot-20261111 \
  --registry data/acquisitions/tsm-authoritative-source-manifest-v1.json

python3 scripts/public_interest/evidence_kit.py compare \
  ./snapshot-20261001 ./snapshot-20261111 \
  --out ./reports/source-revisions.json \
  --html ./reports/source-revisions.html

python3 scripts/public_interest/evidence_kit.py passport \
  ./snapshot-20261111 ./parcel-public-facts.json \
  --as-of 2026-11-11T14:00:00Z \
  --out ./reports/parcel-evidence.json \
  --html ./reports/parcel-evidence.html
```

The output directories must exist; files are created exclusively and cannot silently overwrite previous receipts. The program performs no HTTP requests, never requires a login, and cannot publish its output remotely. The parcel input format (`tsm.public-evidence.parcel-input.v1`) requires `parcelId`, five-digit `countyFips` and bounded `facts` records with `sourceId`, `sourceSha256`, `dataRole`, `label`, `value`, optional `units`, `verticalDatum`, `requiresVerticalDatum` and `observedAt`. Hash/identity mismatches remain explicit.

## Uncertainty lens

Use these machine-readable states in the public scene, future native UE materials, and exported receipts:

| State | Interpretation |
|---|---|
| `EVIDENCE_UNLINKED` | Claimed fact lacks a matching source identity/hash |
| `SOURCE_UNAVAILABLE` | Local source bytes were not verified |
| `VALUE_UNAVAILABLE` | Missing is not zero |
| `UNRESOLVED_DATUM` | Vertical datum missing or inconsistent |
| `MODELED_UNCALIBRATED` | No model calibration reviewed |
| `FORECAST_NOT_OBSERVED` | Future model output is not a measured observation |
| `OBSERVATION_TIME_UNKNOWN` | Time of measurement not supplied |
| `STALE_OBSERVATION` | Observation older than seven days; not live |
| `VALUE_UNREVIEWED` | Source bytes verified, but value and parcel linkage unreviewed |

Never present a source as authoritative *for a particular parcel* solely because it is federal/state public data. `REGULATORY_SOURCE` denotes provenance, not a legal determination. Static reports display text statuses instead of relying on color alone. Native visualization should distinguish these states using labeled overlays, material hatching and clear missing-evidence legends.

## Official modernization references

- USGS modern Water Data OGC API: https://api.waterdata.usgs.gov/ogcapi/v1/ ; migration guide https://api.waterdata.usgs.gov/docs/ogcapi/migration/ . Legacy WaterServices is scheduled for retirement in early 2027. TSM already targets the new service host in its acquisition manifest.
- NOAA/NWS NWPS: https://api.water.noaa.gov/about/api . Separate observation, official forecast, and National Water Model role labels. Do not report an NWPS forecast as a USGS observed gage height.
- OGC 3D Tiles 1.1: https://www.ogc.org/standards/3DTiles/ . A glTF-based renderable tileset and validated geospatial placement are required; GeoJSON is only a staging intermediate.
- Cesium for Unreal local-file loading: https://cesium.com/learn/unreal/unreal-faq/ . Properly packaged local tiles do not inherently require Cesium ion, servers or WebView, but a clean Windows Shipping offline acceptance test is still required.
- USGS 3DEP, FEMA NFHL, Indiana DNR/IGIO, Illinois and Kentucky sources require case-specific acquisition dates, layer coverage, geometry and datum checks. NOAA NGS GEOID18/VDatum transformations must be based on actual published transformation grids and control evidence, not a guessed constant.

## Release-gate matrix

| Workstream | Available foundation | Unresolved acceptance |
|---|---|---|
| Public evidence integrity | Offline verification program and agency-source manifest | Verify complete selected source archives with local SHA and documented metadata |
| Evidence Time Machine | Diff of dated source byte/metadata snapshots | Repeated real acquisitions and retention policy |
| Community Evidence Passport | Redacted JSON and static HTML output | Independently verified parcel-to-source spatial joins, qualified review |
| Uncertainty UX | Machine-readable labeled states | Wire into native UE5.8 material legend and headed screenshot checks |
| Building completeness | IGIO Posey source baseline and reconciliation scripts | Preserve/resolve all 23,082 source identities and height/DEM gaps (issue #416) |
| LOD, georeferenced 3D Tiles | Existing LiDAR, CityJSON and GLB builders | Geometry topology, LOD/texture provenance, correct CRS/vertical placement, validator |
| Native offline Windows | UE5.8 source, TSMData manifest and CI scaffolding | Verified clean Windows 11 x64 Shipping BuildCookRun, no-network startup and headed imagery (issue #414) |
| Scientific interpretation | HEC-RAS/USGS/FEMA/DNR source and modeling contracts | Site-specific inputs, calibration, independent audit and original authority approval where required |

**Public-interest completion** can be demonstrated by the source registry, signed/hashed evidence receipts, transparent limitations, reproducible tests and documentation. **Software release completion** additionally requires the genuine native Shipping evidence. Passing one does not imply the other.

Human Authority Final. These tools are informational, free/offline, and do not imply agency endorsement, a flood-risk determination, survey certification or engineering approval.
