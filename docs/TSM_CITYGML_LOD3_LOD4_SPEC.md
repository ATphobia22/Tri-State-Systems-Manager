# CityGML LoD3 Geometric Precision & LoD4 Interiors — TSM Spec

## LoD3 exterior
- Surfaces: Wall/Roof/Ground/OuterCeiling/OuterFloor/Closure
- Openings: bldg:Window, bldg:Door on BoundarySurface (LoD3+)
- Installations: balconies, dormers, chimneys, stairs
- Precision: pos/height ≤0.5 m class; MLS façade 1–3 cm relative
- Biljecki: LOD3.2 features >1 m; LOD3.3 >0.2 m (embrasures)
- Acquisition: terrestrial MLS / IFC / photogrammetry — not airborne alone
- TSM tiles GE: 0.15 m

## LoD4 interiors (CityGML 2.0)
- Room + InteriorWall/Floor/Ceiling
- IntBuildingInstallation (fixed)
- BuildingFurniture (movable)
- Sublevels: 4.0 rooms only · 4.1 + installations · 4.2 + furniture

## CityGML 3.0
- LoD4 label removed; indoor at any shell LoD 0–3
- IndoorGML complements navigation graph

## TSM policy
- Public: no interiors (publicAllowsIndoor=false)
- Private/NDA: LoD4.0 from IFC after valid LoD3 envelope
