# CityGML 3.0 Compiler Requirements → TSM Implementation

## Conceptual requirements (OGC CityGML 3.0 CM)

1. **Core Space / SpaceBoundary** — volumetric spaces and bounding surfaces; interiors not locked to LOD4 (removed in 3.0).
2. **Modules** — Core mandatory; Building/Construction primary for Posey DT.
3. **Encodings** — CM is encoding-independent (GML, CityJSON, SQL).

## Practical encoding choice

| Encoding | Role in TSM |
|----------|-------------|
| **CityJSON 2.x** | Primary compiler input (CityGML 3.0 subset) |
| CityGML GML XML | External: citygml-tools; not re-implemented |
| 3DCityDB / pg2b3dm | See `docs/3D-TILES-CITYGML-PIPELINE.md` |

## TSM compiler scope (`scripts/geospatial/citygml_compiler.py`)

**In:** CityJSON parse; Space graph; footprints; optional semantic boundaries; CRS allow-list; GeoJSON + state-word v1.

**Out:** Full ADE/17 modules; multi-CRS; complete ImplicitGeometry; direct 3D Tiles write.

Outputs marked `authorityClass=DERIVED`.
