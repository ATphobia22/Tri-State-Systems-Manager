# Flood Data Sources — USGS, FEMA, NASA (v1.0)

**Catalog:** `contracts/registries/tsm-flood-data-sources-catalog-v1.json`  
**Policy:** Inform people; do not silently govern. Human authority remains final.

## Use-case matrix

| Need | Best site | Priority | TSM status |
|------|-----------|----------|------------|
| Real-time conditions | [USGS National Water Dashboard](https://dashboard.waterdata.usgs.gov/app/nwd/en/) | 1 | WIRED_PARTIAL |
| Official NFIP maps | [FEMA NFHL](https://www.fema.gov/flood-maps/national-flood-hazard-layer) | 1 | WIRED |
| Upcoming map changes | [FMCV](https://msc.fema.gov/fmcv) | 1 | CATALOGED |
| Satellite global floods | [NASA Earthdata FLOOD](https://www.earthdata.nasa.gov/data/tools/flood) | 1 | CATALOGED |
| Visualization | [HIVIS](https://apps.usgs.gov/hivis) + Worldview | 2 | CATALOGED |
| GIS analysis | NFHL MapServer | 1 | WIRED |
| Stage inundation libraries | USGS FIM | 2 | CATALOGED |
| Event sensors / HWM | Flood Event Viewer | 2 | CATALOGED |
| Forecasts | NOAA NWPS API | 1 | WIRED |

## Authority rules

- **Effective** NFHL/FIRM/FIS → regulatory path per community  
- **Preliminary/Pending** (FMCV) → awareness only — never label EFFECTIVE  
- USGS live / HIVIS / NASA LANCE → observational only  
- USGS FIM → scenario libraries, limited AOI  

## Wired in TSM

USGS NWIS/OGC stage · NOAA NWPS · FEMA NFHL MapServer + priority layers · FIRM SSOT  

Human authority remains final.
