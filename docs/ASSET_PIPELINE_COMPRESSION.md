# PTDT v35 — Asset Pipeline Compression (USB / Presentation Plane)

Non-mutation rule: all compression outputs feed presentation only; never alter HEC-RAS / PostGIS evidence.

## Houdini VEX → OpenVDB Vector Field
- Offline FLIP → quantize flow direction (8-bit) + magnitude
- Export ~5 MB `.vdb` for Niagara / WebGPU particle advection
- Source: `Houdini_VEX_Fluid_Vector_Field_Generator.c`

## Blender GIS → Math Spline JSON
- Headless OSM/USGS curves → decimated Bezier points (every 2nd)
- Minified JSON for highways / river networks
- Source: `Blender_GIS_to_Math_Spline_Compressor.py`

## WebGPU Terrain
- `photorealTerrain.wgsl`: ray-march DEM, water mask vs BFE 375.0, freeboard cue vs LAG 377.2
- QL2 accuracy bound: RMSEZ ≤ 0.328 ft (USGS 3DEP)

## Cinematic
- Natron headless (4K/1080p via `PTDT_CANVAS_RES`)
- ACEScg + OpenMoonRay path-traced plates; SHA-256 evidence stamp on final frames
