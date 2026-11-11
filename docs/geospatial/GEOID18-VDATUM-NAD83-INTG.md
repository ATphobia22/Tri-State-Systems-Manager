# GEOID18, VDatum, NAD83, and intg.exe (TSM)

## VDatum

NOAA NGS **VDatum** transforms heights among tidal, orthometric, and ellipsoidal systems using regional models (geoid, sea-surface topography, tidal surfaces). For TSM orthometric work on CONUS lidar, the usual path is:

**NAD83 (2011) ellipsoid height \(h\) → GEOID18 → NAVD88 orthometric height \(H\)**

\[
H = h - N
\]

where \(N\) is the GEOID18 geoid height at the point.

Portal: https://vdatum.noaa.gov/

## NAD83

**NAD83** is the primary North American horizontal/geometric datum family (GRS80 ellipsoid). Modern product work commonly uses **NAD83 (2011) epoch 2010.0**. GEOID18 is designed for that realization when producing **NAVD88** heights. Mixing unadjusted WGS84 or other epochs without documented transformation injects horizontal and vertical error.

## Download GEOID18 grids

- Overview: https://www.ngs.noaa.gov/GEOID/GEOID18/
- Downloads: https://geodesy.noaa.gov/GEOID/GEOID18/downloads.shtml
- PC little-endian binaries: https://www.ngs.noaa.gov/PC_PROD/GEOID18/Format_pc/

| File | Coverage (from NGS readme) |
|------|----------------------------|
| g2018u0.bin | Full CONUS 24–58°N, 130–60°W |
| g2018u7.bin | 24–42°N, 96–77°W (covers Posey) |

Use post–26 Nov 2019 little-endian files. Store under `data/raw_hydro/geoid18/` and pin measured SHA-256.

Point sample without local binary: https://www.ngs.noaa.gov/GEOID/GEOID18/computation.html

## Running intg.exe

1. Put `intg.exe` and `g2018u0.bin` (or `g2018u7.bin`) in the same directory.
2. From that directory on Windows:

```text
intg.exe
```

3. Respond to prompts: grid name, coordinate format, lat/lon (Bonebank example: 37.84589, -88.00510).
4. Record the printed geoid height \(N\) (meters). That value is `--geoid-offset-m` for the ingestor — **not** a county constant.

Linux users: NGS also ships `intg_v34.exe` / platform builds from the downloads page; follow the readme for your OS.

## Batch policy

- **Preferred:** NGS interactive computation or official `intg` for site anchors.
- **Scripted intg:** `scripts/geospatial/tsm_geoid18_lookup.py` attempts stdin automation; parse success is environment-dependent — always verify against interactive output for the first tile.
- **Direct binary seek:** Not enabled as production default. CONUS grid dimensions are **4201 × 2041** for grid #0 (NGS downloads page), not ad-hoc 4320-column formulas. Implement only after matching NGS binary layout documentation end-to-end.

## Ingestor

```bash
python scripts/geospatial/tsm_data_ingestor.py \
  --tile your_posey_tile.laz \
  --expected-sha256 "<measured>" \
  --ecef-x 175550.84 --ecef-y -5039980.67 --ecef-z 3892024.17 \
  --ellipsoidal-height-m <h> \
  --geoid-offset-m <N_from_intg> \
  --geoid-model-id GEOID18 \
  --geoid-source-url "https://geodesy.noaa.gov/GEOID/GEOID18/"
```
