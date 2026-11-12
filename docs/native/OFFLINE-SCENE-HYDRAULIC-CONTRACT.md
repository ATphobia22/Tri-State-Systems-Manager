# Offline terrain, buildings and hydraulic frame contract

Run headless: `python scripts/native/validate_offline_scene.py --root tsm-native/Content/TSMData --manifest tsm-native/Content/TSMData/scene-manifest.json`.

Example manifest schema (values below are placeholders, **not evidence**):
```json
{
  "schema": "tsm.offline.scene.v1",
  "horizontal_crs": "EPSG:2966",
  "vertical_datum": "NAVD88",
  "elevation_units": "ftUS",
  "assets": [
    {"kind": "terrain", "path": "terrain/terrain.bin", "sha256": "REPLACE_WITH_REAL_SHA256"},
    {"kind": "buildings", "path": "buildings/tileset.json", "sha256": "REPLACE_WITH_REAL_SHA256"},
    {"kind": "hydraulic_frame", "path": "hydraulics/depth-0001.bin", "sha256": "REPLACE_WITH_REAL_SHA256", "quantity": "depth", "units": "ftUS", "time_utc": "2026-11-11T12:00:00Z", "model_id": "VERIFIED_MODEL_ID", "nodata": "mask"}
  ]
}
```

This is an **asset inventory gate**, not a geospatial format parser or UE renderer. Production ingestion must validate all referenced 3D Tiles child resources, raster metadata, transform/CRS, vertical datum and geoid, NoData mask, bounding boxes, and data licensing separately. A manifest passing this script does not prove the raster or tileset is visually correct.

Existing integration entrypoint: `scripts/native/Generate-TSMNativeMap.ps1` requires `TSM_LOCAL_TILESET`, invokes the Editor Python map authoring script, and checks for a real generated `.umap`. `scripts/native/Build-TSMNativeWindows.ps1` orchestrates the Win64 Shipping packaging. Set up the authorized UE5.8 Windows runner and stage verified local datasets before invoking either; do not claim Shipping passed from a static gate.

Hydrodynamic playback acceptance: source HEC-RAS/HDF5 results are converted headlessly to time-indexed, georeferenced local raster frames; each frame preserves timestamp, quantity, units, source model ID, vertical datum and NoData; the Unreal game thread updates the display texture and timestamps while simulation and conversion stay headless. This PR validates frame inventory and ordering, **not** the Unreal playback renderer.
