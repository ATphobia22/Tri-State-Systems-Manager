# NGS Geodetic Tools Reference (TSM)

Official sources for National Geodetic Survey tools used in TSM elevation, datum, and coordinate work.

## Official GitHub Organization
- https://github.com/noaa-ngs

## Core Tools (source available)
| Tool | Repo | Language | Purpose |
|------|------|----------|---------|
| HTDP | https://github.com/noaa-ngs/HTDP | Fortran | Horizontal time-dependent positioning / crustal motion |
| NCAT lib | https://github.com/noaa-ngs/ncat-lib | Java | Coordinate conversion & transformation engine |
| INTG / XINTG | https://github.com/noaa-ngs/intg , https://github.com/noaa-ngs/xintg | C | GEOID18 / hybrid geoid interpolation |
| INVERSE / FORWARD | https://github.com/noaa-ngs/inverse , https://github.com/noaa-ngs/forward | Fortran | Geodetic inverse / forward computations |
| ADJUST | https://github.com/noaa-ngs/adjust | Fortran | Least-squares adjustment |

## GEOID18 Interpolation Models
- Model page: https://www.ngs.noaa.gov/GEOID/GEOID18
- Downloads: https://geodesy.noaa.gov/GEOID/GEOID18/downloads.shtml
- Technical report: NOAA Technical Report NOS NGS 72
- Grids (binary):
  - `g2018u0.bin` — full CONUS
  - `g2018u1.bin` … `g2018u8.bin` — CONUS tiles
  - `g2018p0.bin` — Puerto Rico / USVI
- Interpolation: INTG (bilinear/spline). Source in noaa-ngs/intg.
- Coverage: CONUS + PR/USVI only. Alaska/Hawaii/Guam continue on GEOID12B.

## Closed / Binary-Only
- **VDatum** — https://vdatum.noaa.gov (no official source repo). Python wrappers: vyperdatum, coastalmodeling-vdatum
- **OPUS / OPUS Projects** — closed service; limited shared-solution API only
- **LOCUS** — web service only; no public source

## Python Bindings / Wrappers
- NCAT API: https://github.com/HaydenElza/ncat-python (`pip install ncat`)
- VDatum / grids: https://github.com/noaa-ocs-hydrography/vyperdatum
- Coastal VDatum: https://github.com/oceanmodeling/coastalmodeling-vdatum
- General geodesy: https://github.com/GeoscienceAustralia/GeodePy

## Official Docs
- NGS Geodetic Toolkit: https://geodesy.noaa.gov/TOOLS/
- NCAT: https://geodesy.noaa.gov/NCAT/
- HTDP: https://geodesy.noaa.gov/TOOLS/Htdp/Htdp.shtml
- GEOID models: https://geodesy.noaa.gov/GEOID/
- Web services: https://www.ngs.noaa.gov/web_services/

Human authority remains final. Presentation ≠ regulation.
