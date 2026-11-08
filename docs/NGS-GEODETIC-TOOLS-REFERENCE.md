# NGS Geodetic Tools Reference (TSM)

Official sources for National Geodetic Survey tools used in TSM elevation, datum, and coordinate work.

## Official GitHub Organization
- https://github.com/noaa-ngs

## Core Tools (source available)
| Tool | Repo | Language | Purpose |
|------|------|----------|---------|
| HTDP | https://github.com/noaa-ngs/HTDP | Fortran | Horizontal only — time-dependent positioning / crustal motion |
| NCAT lib | https://github.com/noaa-ngs/ncat-lib | Java | Coordinate conversion & transformation |
| INTG / XINTG | https://github.com/noaa-ngs/intg , https://github.com/noaa-ngs/xintg | C | GEOID hybrid geoid interpolation |
| INVERSE / FORWARD | https://github.com/noaa-ngs/inverse , https://github.com/noaa-ngs/forward | Fortran | Geodetic inverse / forward |
| ADJUST | https://github.com/noaa-ngs/adjust | Fortran | Least-squares adjustment (Bluebook formats) |

## HTDP / GNSSTK Scope
- HTDP: horizontal positions/velocities only; not vertical datum.
- GNSSTK: ellipsoidal height + geodetic↔geocentric; no GEOID18/NAVD88/tidal.

## NGS GEOID Models
- Hybrid current: **GEOID18** (CONUS + PR/VI); GEOID12B elsewhere
- Gravimetric / experimental: USGG*, xGEOID14–20
- Next: NAPGD2022 / GEOID2022 (beta)
- Grids: `g2018u0.bin` + tiles; https://geodesy.noaa.gov/GEOID/GEOID18/downloads.shtml

## Related NGS Data Services (mostly closed / service-only)
| Item | Status | Notes |
|------|--------|-------|
| Survey mark datasheets / PID | Service | https://geodesy.noaa.gov/datasheets/ — no public core API repo |
| OPUS / OPUS Share / OPUS Projects | Closed | Web submission; limited shared-solution output |
| NCN / CORS RINEX | Data open | https://geodesy.noaa.gov/corsdata/ + AWS; community downloaders exist |
| ANTINFO (antenna calibrations) | Data files | NGS antinfo tables; used by processing software |
| Bluebook validation | Partial | ADJUST accepts Bluebook formats; full Bluebook suite not fully open |
| LOCUS (leveling) | Closed | Web service only |
| GRAV-D | Data open | Airborne gravity products; community loaders (e.g. rockhound/ensaio) |
| GSVS / GPS on BM | Campaign data | Used to build hybrid GEOIDs; no full open processing suite |
| Coastal imagery / lidar / VDatum | Mixed | VDatum closed; coastal lidar via NOAA Digital Coast |

## Community Tools (CORS / gravity)
- CORS RINEX download helpers: various small scripts (e.g. GNSS-download-tool, GOOD)
- GRAV-D data: fatiando/rockhound (legacy) → ensaio; PFPE/shipgrav (marine)
- VDatum + PROJ: https://github.com/noaa-ocs-hydrography/vyperdatum
- NCAT client: https://github.com/HaydenElza/ncat-python
- pyproj / GeodePy / GNSSTK as previously listed

## TSM Integration Points
- Elevation / freeboard / LAG-BFE: GEOID18 + INTG or pyproj
- LOMA / 13101 Bonebank: NAD83(2011) + NAVD88 via GEOID18
- Control marks / CORS: use official NGS services; do not invent PIDs or velocities
- Human authority final; no silent LOMA auto-file

## Official Docs
- https://geodesy.noaa.gov/TOOLS/
- https://geodesy.noaa.gov/NCAT/
- https://geodesy.noaa.gov/datasheets/
- https://geodesy.noaa.gov/corsdata/
- https://geodesy.noaa.gov/GEOID/
- https://vdatum.noaa.gov/

Human authority remains final. Presentation ≠ regulation.
