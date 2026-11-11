# ECEF / 3D Tiles spatial validation (Posey County)

## Scripts

| Script | Role |
|--------|------|
| `scripts/geospatial/tsm_tileset_packager.py` | Stage offline dir / write validated stub root |
| `scripts/geospatial/tsm_ecef_validator.py` | ECEF translation + orthonormal R + box extents |
| `tests/geospatial/test_tsm_tileset_validator.py` | Structure + optional GLB magic |

CI: `.github/workflows/tsm-geospatial-ci.yml`

## Corrected Posey ECEF window

WGS84 samples near Posey / Bonebank yield **positive X** (~1.7e5–1.9e5 m), **Y** ~−5.04e6 m, **Z** ~3.89e6 m.  
Earlier draft bounds with **negative X** were incorrect for this longitude and would reject valid tiles.

## Policy

- Explicit root `transform` required for offline Posey package (no silent identity).
- Staging tileset is **DERIVED_STAGING** — not survey, not complete building inventory.
- Replace stub with real GLB/HLOD before native Shipping claims.

```bash
python scripts/geospatial/tsm_tileset_packager.py
python scripts/geospatial/tsm_ecef_validator.py
python tests/geospatial/test_tsm_tileset_validator.py
```
