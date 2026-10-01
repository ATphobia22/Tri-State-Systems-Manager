# PROVENANCE — Historical USGS gauge observations (static, non-live)

- **Source:** USGS Water Services, NWIS daily values (`nwis/dv`), `statCd=00003` (daily mean).
- **Acquired:** 2026-10-01 by `~/workspace/build-scripts/dl_usgs_historical.py` + `retry_usgs_historical.py`.
- **Period:** 2016-01-01 to 2026-10-01. Parameters 00060 (discharge, ft³/s) and 00065 (gage height, ft) per station.
- **Status:** Static historical observations. NOT live data. No polling, no refresh schedule.
  Per owner direction 2026-10-01: river data yes, live polling no. Live values are
  only fetched when the user presses the snapshot button in the console.
- **Files:** `usgs-<site>-dv-2016-2026.json` per station; `manifest.json` indexes byte counts and value counts.
- **Station-name correction:** the TSM registry labels USGS 03378500 "Wabash River at New Harmony, IN";
  the station is the **Wabash River at Mount Carmel, IL**. The file name uses the site number only.
- **Gage datum:** 00065 values are on the USGS gage datum, not NAVD88. Do not mix with BFE/LAG elevations.
- **Provisional:** recent daily values may carry USGS provisional qualifiers; see per-value qualifiers in the JSON.
