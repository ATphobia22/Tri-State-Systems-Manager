# Operational Runbook — Open World Twin (2026-10-19)

## Runtime (console)
- `ThreeDTilesLayer` applies `tile-stream-runtime` each frame (SSE errorTarget + phase telemetry).
- Import surface: `import { decideTileStream, applyStreamBudgetToTilesRenderer } from '../geospatial'`.
- Sources: self-hosted tilesets only; fail-closed on load error (no fabricated geometry).

## Geospatial jobs
```bash
# CityJSON → DERIVED tileset shell
python3 scripts/geospatial/cityjson_to_3d_tiles.py path/to/city.city.json -o out_tiles/

# Lengyel tables
python3 scripts/geospatial/regenerate_lengyel_tables.py
python3 scripts/geospatial/transvoxel_tables.py
python3 scripts/geospatial/transvoxel_transition_mesh.py --self-test

# Synthetic DEM Stage 1–2 (CI-safe)
python3 scripts/geospatial/dem_to_transvoxel_selftest.py

# Real Posey DEM cook (local only — set DEM path in dem_to_transvoxel.py)
python3 scripts/geospatial/dem_to_transvoxel.py --wx 0 --wy 0 --n 64 --out /tmp/tvx

# SSE cert against published Posey tileset
python3 scripts/geospatial/sse_live_cert.py
```

## CI
- Workflow: `.github/workflows/geospatial-blueprint-ops.yml`
- Open World Twin Validation remains the console contract gate.
- Status seal: `docs/ops/FINISHING-TOUCHES-COMPLETE-2026-10-19.md`

## Authority
All compiled / CE / procedural meshes: `authorityClass=DERIVED`. Regulatory elevation remains NAVD88 evidence plane only.
