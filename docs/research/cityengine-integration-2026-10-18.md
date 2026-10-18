# CityEngine Integration Investigation (2026-10-18)

## Product posture

ArcGIS CityEngine is **procedural CGA** modeling (urban design / VFX), not a CityGML native authoring system. Recent versions (2025.x) emphasize Street Designer, Visual CGA, experimental Python 3 API; licensing is subscription-oriented.

## Native format matrix (CityEngine export)

**Supported (documented):** glTF, USD, FBX, Alembic, OBJ, COLLADA, FileGDB multipatch, KMZ/KML, SLPK, Datasmith, etc.

**Not in the standard model-export table as first-class CityGML/CityJSON writers.** CityGML/CityJSON interoperability is therefore **indirect**.

## Recommended TSM bridges

```
Posey footprints (GeoJSON)
    → CityEngine shapes + CGA (procedural facades/LOD)
    → Export glTF 2.0 (PBR)
    → TSM bake-pbr / 3D Tiles / RTC upload

CityJSON (authoritative semantics)
    → citygml_compiler.py (Space graph)
    → optional: external CE only for visual massing (DERIVED)
```

| Direction | Path | Notes |
|-----------|------|-------|
| CE → TSM | glTF export (recommended) | Instancing + PBR; aligns with 3D Tiles 1.1 content |
| CE → TSM | FileGDB multipatch | GIS-centric; convert via GDAL/ArcPy to mesh |
| TSM → CE | Footprint polygons / DXF / OBJ | Initial shapes for CGA |
| Semantics | CityJSON stays in TSM compiler | CE does not replace Space/SpaceBoundary graph |

## SDK / automation

- **CityEngine SDK / PRT**: custom encoders, headless rule application (`prt4cmd`); requires CE version-matched SDK and commercial license.
- **CityEngine for Houdini**: RPK execution in Houdini — useful if VFX path already exists; not required for web DT.

## Constraints for sovereign / evidence stack

1. CE outputs are **presentation/derived**, not FEMA/IDNR authority.
2. Do not hard-depend CE in CI (license + closed binary).
3. Prefer open path: CityJSON → `citygml_compiler` → existing tiles builders.
4. If CE is used: pin export to **glTF**, run TSM PBR atlas + RTC, attach state-word v1.

## Decision

**Default: no CityEngine runtime dependency.** Optional offline authoring bridge via glTF only (P3 tasks). CityGML semantics remain CityJSON + `citygml_compiler.py` + external `citygml-tools` for GML.
