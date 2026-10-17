# Data fabrics status — unfinished / fixed / next download (2026-10-17)

## Status matrix (updated after API fixes)

| Fabric | Status | Notes |
|--------|--------|-------|
| **NID Posey** | **FIXED — official API** | 5 dams with coordinates from `nid.sec.usace.army.mil/api/query` |
| **IGIO Building Footprints** | **FIXED URL** | `Hosted/Building_Footprints` — 16,116 in Posey envelope |
| **FEMA NFHL** | **REST registry live** | Canonical public MapServer and layer IDs are documented; portal viewer/search pages are discovery UI, not bulk downloads |
| **buildings-3d / MS / Overture** | **Existing extracts; bounded refresh documented** | Overture Posey extracts/shard manifests exist; new downloads use explicit AOI bbox and preserve ODbL/release provenance |
| **Critical facilities HIFLD** | **CLOSED 2026-10-17** | 15 fire stations + 14 fire depts (NERIS live); 0 hospitals in Posey (verified) |
| **data/fabrics/live** | Empty | Optional |

| **Indiana 2016–2020 QL2 elevation** | **Partially acquired** | 581 tile references in manifest; a Posey 2.5-ft DEM tile and small derivatives are committed; statewide dataset not mirrored |\n| **NOAA 2024 Indiana Coastline LiDAR (10356)** | **Registered / out of current AOI** | NOAA index advertises ~24 GB / 2,139 LAZ tiles for NW Indiana, NE Illinois, SW Michigan; OpenTopography web workflow has eligibility restrictions |\n\n## Working endpoints

See `data/fabrics/api-endpoint-registry-fixed.json`, `docs/fabrics/NFHL-NID-PROTOCOLS-2026-10-17.md`, and [source access and acquisition notes](OVERTURE-INDIANA-LIDAR-FEMA-ACCESS-2026-10-17.md).
