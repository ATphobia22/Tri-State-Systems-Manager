# P2 CityGML depth — prep notes (blueprint complete scope)

## P2.1 Multi-LOD geometry pick
Compiler prefers highest available `lod` ≤ requested when multiple geometry entries exist (see `citygml_compiler.py` `_select_geometry`).

## P2.2 GML pre-step (external)
```bash
# Do not reimplement GML XML in-repo
citygml-tools to-cityjson city.gml -o city.city.json
python3 scripts/geospatial/citygml_compiler.py city.city.json -o out/
python3 scripts/geospatial/cityjson_to_3d_tiles.py city.city.json -o out_tiles/
```

## P2.3 CRS → EPSG:2966
Optional post-step with pyproj when source is EPSG:4326/4269. Fail-closed if vertical is not NAVD88 for regulatory claims.

## P2.4 Validation
Use external `citygml-tools validate` / val3dity on fixtures in CI when tooling is available; fixtures under `tests/fixtures/`.
