# NGS Geodetic Tools Reference (TSM)

Official sources for National Geodetic Survey tools used in TSM elevation, datum, and coordinate work.

## Official GitHub Organization
- https://github.com/noaa-ngs

## Core Tools (source available)
| Tool | Repo | Language | Purpose |
|------|------|----------|---------|
| HTDP | https://github.com/noaa-ngs/HTDP | Fortran | **Horizontal only** — time-dependent positioning / crustal motion. Not for vertical. |
| NCAT lib | https://github.com/noaa-ngs/ncat-lib | Java | Coordinate conversion & transformation engine |
| INTG / XINTG | https://github.com/noaa-ngs/intg , https://github.com/noaa-ngs/xintg | C | GEOID hybrid geoid interpolation |
| INVERSE / FORWARD | https://github.com/noaa-ngs/inverse , https://github.com/noaa-ngs/forward | Fortran | Geodetic inverse / forward |
| ADJUST | https://github.com/noaa-ngs/adjust | Fortran | Least-squares adjustment |

## HTDP Scope
Horizontal positions and velocities only. No NAVD88 / orthometric / tidal conversion.

## GNSSTK Vertical Datum Options
- Repo: https://github.com/SGL-UT/gnsstk
- Provides: geodetic ↔ geocentric coordinate transforms, ellipsoidal height `h`, WGS84 ellipsoid math.
- Does **not** include NGS hybrid geoid models (GEOID18), NAVD88, or tidal datums.
- For TSM vertical: use GEOID18 grids + INTG/pyproj or vyperdatum — not GNSSTK alone.

## NGS GEOID Models (explore)
**Hybrid** (NAD83 ellipsoid → regional orthometric):
- CONUS / PRVI: **GEOID18** (current; supersedes GEOID12B)
- Alaska / Hawaii / Guam-CNMI / AS: GEOID12B (and older 12A/09)
- Historical: GEOID12A, GEOID09, GEOID03, GEOID99, GEOID96

**Gravimetric** (ITRF → geoid surface; not NAVD88):
- USGG2012, USGG2009, USGG2003, G99SSS, G96SSS
- Experimental xGEOID14 → xGEOID20 (prep for NAPGD2022)

**Next generation**: NAPGD2022 / GEOID2022 (beta grids available)
- https://beta.ngs.noaa.gov/NAPGD2022/
- GEOID18 is last hybrid before NSRS modernization.

**GEOID18 grids**: `g2018u0.bin` (CONUS), u1–u8 tiles, `g2018p0.bin` (PR/USVI)
- Downloads: https://geodesy.noaa.gov/GEOID/GEOID18/downloads.shtml
- Model page: https://www.ngs.noaa.gov/GEOID/GEOID18

## Closed / Binary-Only
- VDatum — https://vdatum.noaa.gov
- OPUS / OPUS Projects
- LOCUS

## Community Toolkits
- NCAT client: https://github.com/HaydenElza/ncat-python
- VDatum + PROJ: https://github.com/noaa-ocs-hydrography/vyperdatum
- Coastal VDatum: https://github.com/oceanmodeling/coastalmodeling-vdatum
- GNSSTK: https://github.com/SGL-UT/gnsstk
- GeodePy: https://github.com/GeoscienceAustralia/GeodePy
- pyproj: https://github.com/pyproj4/pyproj

## TSM Integration Points
- Elevation / freeboard / LAG-BFE: GEOID18 + INTG or pyproj + g2018 grids
- LOMA / 13101 Bonebank: NAD83(2011) + NAVD88 via GEOID18
- Crustal / epoch: HTDP (horizontal only)
- Twin / MapTwin: vyperdatum or pyproj vertical; NCAT horizontal
- Human authority final; no silent LOMA auto-file

## Official Docs
- https://geodesy.noaa.gov/TOOLS/
- https://geodesy.noaa.gov/NCAT/
- https://geodesy.noaa.gov/TOOLS/Htdp/Htdp.shtml
- https://geodesy.noaa.gov/GEOID/

Human authority remains final. Presentation ≠ regulation.
