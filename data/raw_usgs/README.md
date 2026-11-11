# Raw USGS / 3DEP inputs

Place official lidar/DEM downloads here (`.laz`, `.las`, `.tif`).

- Do not commit large binaries to Git.
- Record SHA-256 + official URL in `integrations/registry/tsm-immutable-source-manifest-v1.json`.
- Ingest via `scripts/geospatial/tsm_data_ingestor.py` with explicit GEOID provenance when claiming NAVD88.
