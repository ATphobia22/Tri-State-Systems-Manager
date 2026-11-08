# NGS Geodetic Tools Reference (TSM)

Official sources for National Geodetic Survey tools used in TSM elevation, datum, and coordinate work.

## Official GitHub Organization
- https://github.com/noaa-ngs

## Core Tools (source available)
| Tool | Repo | Language | Purpose |
|------|------|----------|---------|
| HTDP | https://github.com/noaa-ngs/HTDP | Fortran | **Horizontal only** — time-dependent positioning / crustal motion (NAD83 ↔ ITRF/WGS84). Not for vertical datum. |
| NCAT lib | https://github.com/noaa-ngs/ncat-lib | Java | Coordinate conversion & transformation engine |
| INTG / XINTG | https://github.com/noaa-ngs/intg , https://github.com/noaa-ngs/xintg | C | GEOID18 / hybrid geoid interpolation |
| INVERSE / FORWARD | https://github.com/noaa-ngs/inverse , https://github.com/noaa-ngs/forward | Fortran | Geodetic inverse / forward computations |
| ADJUST | https://github.com/noaa-ngs/adjust | Fortran | Least-squares adjustment |

## HTDP Scope (important)
HTDP transforms horizontal positions and velocities across time and reference frames. It does **not** perform vertical datum conversion (NAVD88 ↔ ellipsoid ↔ tidal). Use VDatum / GEOID18 / vyperdatum for heights.

## GEOID18 Interpolation Models
- Model page: https://www.ngs.noaa.gov/GEOID/GEOID18
- Downloads: https://geodesy.noaa.gov/GEOID/GEOID18/downloads.shtml
- Grids: `g2018u0.bin` (CONUS), tiles u1–u8, `g2018p0.bin` (PR/USVI)
- Source: noaa-ngs/intg (bilinear/spline)

## Closed / Binary-Only
- **VDatum** — https://vdatum.noaa.gov (vertical: orthometric / ellipsoidal / tidal)
- **OPUS / OPUS Projects** — closed service
- **LOCUS** — web service only

## Community Toolkits & Python
- NCAT client: https://github.com/HaydenElza/ncat-python
- VDatum + PROJ: https://github.com/noaa-ocs-hydrography/vyperdatum
- Coastal VDatum: https://github.com/oceanmodeling/coastalmodeling-vdatum
- GNSSTK (successor to GPSTk): https://github.com/SGL-UT/gnsstk
- GeodePy: https://github.com/GeoscienceAustralia/GeodePy
- pyproj (PROJ grids / GEOID): https://github.com/pyproj4/pyproj

## TSM Integration Points
- Elevation / freeboard / LAG-BFE: GEOID18 + INTG or pyproj + g2018 grids
- LOMA / site constants (13101 Bonebank): NAD83(2011) + NAVD88 via GEOID18
- Crustal / epoch updates: HTDP (horizontal only)
- Digital Twin / MapTwin: prefer vyperdatum or pyproj for vertical; NCAT for horizontal SPC/UTM
- No silent auto-filing of LOMA; human authority final

## Official Docs
- Toolkit: https://geodesy.noaa.gov/TOOLS/
- NCAT: https://geodesy.noaa.gov/NCAT/
- HTDP: https://geodesy.noaa.gov/TOOLS/Htdp/Htdp.shtml
- GEOID: https://geodesy.noaa.gov/GEOID/

Human authority remains final. Presentation ≠ regulation.
