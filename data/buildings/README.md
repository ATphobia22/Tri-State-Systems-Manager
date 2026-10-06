# Posey building footprints pipeline

**Authority:** `DERIVED` only — never engineering or regulatory determination.

## Sources

| Source | Status |
|--------|--------|
| IGIO free statewide building outlines | **Not available** (buy-up on imagery program) |
| Microsoft US Building Footprints (Indiana) | Preferred free CV footprints (ODbL) |
| Parcel-fraction derivation | Repo fallback (`posey-buildings-derived.geojson`) |

MS download:
```
https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/Indiana.geojson.zip
```

## Run

```bash
# Full pipeline (uses parcel fallback if MS zip not set)
bash scripts/geospatial/run-buildings-pipeline.sh

# With Microsoft footprints
MS_ZIP=/path/Indiana.geojson.zip bash scripts/geospatial/run-buildings-pipeline.sh

# Smoke (50 features)
LIMIT=50 bash scripts/geospatial/run-buildings-pipeline.sh
```

## Outputs

- `data/buildings/posey-ms-buildings-aoi.geojson` — clipped footprints + provenance
- `data/buildings/posey-buildings-elev-joined.geojson` — + NAVD88 elev samples
- `tsm-console/public/data/buildings-3d-tiles/` — LOD1+HLOD tileset for Pages SPA
- `SOURCE_MANIFEST.json` / `SHA256SUMS` / `PUBLISH_INVENTORY.json`

## Vertical / horizontal

- Horizontal: EPSG:4326 storage; area ops may use EPSG:2966
- Vertical: ft NAVD88 via Terrain-RGB decode (screening-grade)
- Null elevation = unavailable, never zero
