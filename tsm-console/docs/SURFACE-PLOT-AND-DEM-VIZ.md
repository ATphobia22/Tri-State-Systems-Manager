# Surface plot & DEM visualization notes

Reference: ImageJ *Interactive 3D Surface Plot* (Kai Uwe Barthel) — luminance → height, mesh/filled modes, grid size, texture map.

## Mapping to TSM

| Desktop concept | TSM path |
|-----------------|----------|
| Luminance as Z | DEM / depth GeoTIFF band as height field |
| Grid size 32–512 | `ras-geotiff-ingest.mjs` `--maxDim` stride downsample |
| Texture map | Ortho / intensity tile overlay on MapLibre / Three |
| Snapshot stack | Cinematic affidavit + USD export (VISUALIZATION) |

Offline DEM inspection can still use ImageJ + the plugin; the web twin uses MapLibre terrain + Three water plane + optional downsampled RAS depth cells.

Do not treat surface-plot screenshots as LOMA evidence without Class 2 LAG extraction and human package review.

