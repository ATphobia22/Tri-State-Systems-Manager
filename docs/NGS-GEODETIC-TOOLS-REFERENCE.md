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

## TSM runtime clients (live official APIs)
| Client | Path | Endpoint |
|--------|------|----------|
| NCAT | `packages/geo/src/geodesy/NcatClient.ts` | `https://geodesy.noaa.gov/api/ncat/llh` |
| VDatum | `packages/geo/src/geodesy/VDatumClient.ts` | `https://vdatum.noaa.gov/vdatumweb/api/convert` |

Contract tests: `tests/contracts/ncat-live-client.test.ts`, `tests/contracts/vdatum-live-client.test.ts`  
Skip live: `TSM_SKIP_LIVE_NCAT=1` / `TSM_SKIP_LIVE_VDATUM=1`

## HTDP / GNSSTK Scope
- HTDP: horizontal positions/velocities only; not vertical datum.
- GNSSTK: ellipsoidal height + geodetic↔geocentric; no GEOID18/NAVD88/tidal.

## NGS GEOID Models
- Hybrid current: **GEOID18** (CONUS + PR/VI); GEOID12B elsewhere
- Gravimetric / experimental: USGG*, xGEOID14–20
- Next: NAPGD2022 / GEOID2022 (beta)
- Grids: `g2018u0.bin` + tiles; https://geodesy.noaa.gov/GEOID/GEOID18/downloads.shtml

## VDatum integration methods
1. **Online API** — `VDatumClient` (point convert; human-gated)
2. **Desktop VDatum** — Java + grids from vdatum.noaa.gov
3. **vyperdatum + PROJ** — local high-volume / rasters (`VYPER_GRIDS`)
4. **NCAT** — horizontal + limited vertical; prefer VDatum for tidal/orthometric

## Related NGS Data Services (mostly service-only)
| Item | Status | Notes |
|------|--------|-------|
| Survey mark datasheets / PID | Service | https://geodesy.noaa.gov/datasheets/ |
| OPUS / OPUS Share | Closed | Web submission |
| NCN / CORS RINEX | Data open | https://geodesy.noaa.gov/corsdata/ + AWS |
| ANTINFO | Data files | Antenna calibrations |
| Bluebook | Partial | ADJUST accepts Bluebook formats |
| LOCUS | Closed | Leveling web service |
| GRAV-D | Data open | Community loaders (ensaio / rockhound) |
| Coastal lidar | Open data | NOAA Digital Coast |

## Community Tools
- VDatum + PROJ: https://github.com/noaa-ocs-hydrography/vyperdatum
- NCAT client (Python): https://github.com/HaydenElza/ncat-python
- pyproj / GeodePy / GNSSTK

## TSM Integration Points
- Elevation / freeboard / LAG-BFE: GEOID18 validators + VDatum/NCAT clients
- LOMA / 13101 Bonebank: NAD83(2011) + NAVD88; human authority final
- Control marks / CORS: official NGS services only

## Official Docs
- https://geodesy.noaa.gov/TOOLS/
- https://geodesy.noaa.gov/NCAT/
- https://vdatum.noaa.gov/docs/services.html
- https://geodesy.noaa.gov/GEOID/

Human authority remains final. Presentation ≠ regulation.
