# PDAL Classification Filters & CityGML LoD (TSM)

## ASPRS classes for PDAL filters.range
| Code | Class | TSM |
|------|-------|-----|
| 2 | Ground | Bare-earth DEM |
| 6 | Building | Building LAZ / LoD cues |
| 3-5 | Vegetation | Canopy |
| 9 | Water | Hydro |

```json
{"type":"filters.range","limits":"Classification[2:2]"}
{"type":"filters.range","limits":"Classification[6:6]"}
{"type":"filters.range","limits":"ReturnNumber[1:1]"}
```

## CityGML LoD
- CG2: LoD0 footprint · LoD1 extruded · LoD2 roofs · LoD3 openings · LoD4 indoor
- CG3 / 3DCityDB V5: LoD0-3 shell; indoor at any LoD; true PostGIS solids
- TUM viz: LoD0 footprint · LoD1 extruded · LoD2 geometry±textures

## Pipeline
EPT → class2 DEM + DSM/class6 → LoD1 heights → CityGML → 3DCityDB (SRID 26916) → tiles
LoD3 needs MLS/IFC. Public indoor off.
