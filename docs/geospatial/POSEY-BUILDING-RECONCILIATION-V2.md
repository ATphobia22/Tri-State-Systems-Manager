# Posey County building inventory — acceptance policy v2.0.0

The historical 23,082-feature inventory is retired as a **production acceptance threshold**. Keep old snapshots and associated receipts as `HISTORICAL_UNVERIFIED` audit evidence; do not delete the only copy before a replacement has been acquired and verified. This policy does **not** assert that a fresh acquisition, height extraction, 3D Tiles release, or regulatory certification has succeeded.

## Authoritative acceptance

1. Fetch the live Indiana Geographic Information Office [Building Footprints FeatureServer layer 0](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0) for `county='Posey'`. Query the count and complete source OBJECTID list independently, then download all official geometry pages with exact-ID reconciliation. Use `scripts/geospatial/posey_official_inventory.py --output /path/fresh-receipt.json --geometry-dir /path/fresh-pages`; preserve date, service edit version, request/response digests, and page hashes. Source geometry has no Z and is not building height evidence. Do not use a ZIP 47620 bounding box as countywide coverage.
2. Never infer source cardinality from 23,082 or any past release. Reject duplicates, missing IDs, source-version drift, unverified county metadata, geometry errors, incomplete pages or missing snapshot checksums. If retrieval cannot finish, report `SOURCE_UNAVAILABLE` and **do not promote** the old inventory.
3. Reconcile the exact source OBJECTID set against *one accounted-for record per authoritative ID*; coverage = |unique source IDs accounted for| / |unique source IDs|. Both sets must match; no additional account records. Count-only equality is insufficient. Persist canonical ID-set digest and source-file SHA-256.
4. Every account record must contain a reconstruction status (e.g., `LOD3_TEXTURED_VERIFIED`, `LOD2_ROOF_RECONSTRUCTED`, `LOD1_MEASURED`, `LOD1_ESTIMATED`, `FOOTPRINT_ONLY`, `INSUFFICIENT_LIDAR`, `INSUFFICIENT_IMAGERY`, `INVALID_SOURCE_GEOMETRY`, `PENDING_RECONSTRUCTION`, `RECONSTRUCTION_FAILED`), evidence source, uncertainty (value and units, or explicit `null` with reason), and review state. Missing evidence must remain missing; never synthesize roof or foundation heights.
5. Separate **identity acceptance** (all authoritative IDs accounted for) from **mesh release acceptance** (correct geodetic conversions, measured/derived provenance, geometry errors, 3D Tiles/glTF validation, SHA-256 for each asset, headed Cesium verification, native Unreal/Windows checks where applicable, and qualified human review). Identity-only acceptance is not engineering or regulatory certification.

## Source status and deletion safeguards

The existing `igio-posey-20261006` release, archived `POSEY-STAGED-2D-23082-2026-11-09.json` receipt, previously exported GeoJSON, and historical Google Drive database are **superseded candidates**; do not put them in fresh-source production manifests without a new official retrieval receipt. Once a fresh source passes all source gates, switch the active catalog pointer to the content-addressed new version, then archive earlier artifacts. Never silently delete audit evidence. Preserve incompatible source differences in a before/after report.

## Execution and compatibility

The `posey_official_inventory.py` worker is headless; store exact source responses, checksums, report and immutable acquisition artifacts in Google Drive `Tri-State System Manager/Building Reconstruction/`. The present policy implementation does not itself create photorealistic tiles, migrate databases, or merge unrelated branches. Use a separate verified release gate before publishing any building asset.

This policy supersedes hardcoded counts **for new authoritative inventory reconciliation**. Legacy historical or sample tests may still intentionally pass an explicit expected count for retrospective, nonproduction comparisons.
