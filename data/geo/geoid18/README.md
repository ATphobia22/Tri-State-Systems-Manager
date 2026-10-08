# NGS GEOID18 CONUS Grid — Provenance

## File
- **Filename:** `g2018u0.bin`
- **Format:** NGS GEOID18 binary, Big-Endian ("unix" build)
- **Size:** 34,297,008 bytes
- **SHA-256:** `c41654f1c3cc485f302e3bc8e6837fefb1db02b923fb3b6e4ded850c18caeabe`
- **Downloaded:** 2026-10-08
- **Source URL:** https://www.ngs.noaa.gov/PC_PROD/GEOID18/Format_unix/g2018u0.bin
- **Downloads page:** https://www.ngs.noaa.gov/GEOID/GEOID18/downloads.shtml

## Why Big-Endian
The Little-Endian "pc" build (Format_pc) of the 2019 GEOID18 compilation had
decimeter-level errors. The Big-Endian "unix" build is the correct one and is
what NGS serves as authoritative. This vendored copy is the Big-Endian build.

## Grid parameters (from 44-byte header)
- SW corner: lat 24.0°, lon 230.0°E (= 130.0°W)
- Spacing: 1 arc-minute (0.016667°) in both directions
- Dimensions: 4201 columns × 2041 rows
- Kind: 1 (geoid undulation N, meters, relative to WGS84 ellipsoid)

## Usage
`scripts/geospatial/tsm_geodesy.py` loads this file via `GeoidGrid` and performs
bilinear interpolation per coordinate. There are no regional constants anywhere
in the pipeline. If this file is missing or a coordinate falls outside CONUS
coverage, the geodesy module fails closed (raises) rather than substituting
a value.

## License
U.S. Government work, public domain (NOAA National Geodetic Survey).
