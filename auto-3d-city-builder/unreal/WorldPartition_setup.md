# Unreal Engine 5.5+ World Partition — Mount Vernon / TSM

## Grid
- Cell size: 128–256 m municipal core; 512 m fringe
- Data Layers: Terrain, Buildings_LoD1, Buildings_LoD2, Roads, Utilities_Public, Flood_Overlays, Sim_SDF_Deltas

## Coordinate policy
- Authoring EPSG:26916 m with local RTC-like origin near (-88.0142, 37.8348)
- Document NAVD88 vs ellipsoid in actor metadata

## Safety
Public packages must not embed CEII / restricted utility solids.
