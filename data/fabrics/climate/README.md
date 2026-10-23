# PRISM Climate Normals — Tri-State Clip

30-year (1991–2020) annual normals from the PRISM Climate Group,
Oregon State University, clipped to the tri-state window
(lon −90 to −86, lat 37 to 39.5).

| File | Variable | Units | Nodata |
|------|----------|-------|--------|
| `ppt_annual_tristate.npy` | Mean annual precipitation | mm | −9999 |
| `tmean_annual_tristate.npy` | Mean annual temperature | °C | −9999 |

Each `.npy` is a float32 (300, 480) grid with a `.transform.json`
sidecar holding the affine `[a, b, c, d, e, f]` and a
`.provenance.json` with source/FTP path/download date.

**Source:** https://prism.oregonstate.edu/normals/
**FTP:** `ftp.prism.oregonstate.edu/normals/us/800m/{ppt,tmean}/monthly/prism_{var}_us_30s_2020_avg_30y.zip`
**Resolution:** 800 m (30 arc-second). **License:** free for use with
acknowledgment per PRISM terms of use.

**Validation (2026-10-23):** tri-state bbox (lon −88.7…−87.2,
lat 37.6…38.5) zonal means: ppt = 1207 mm, tmean = 13.6 °C —
both within expected climatology for the Ohio–Wabash confluence.

**Full CONUS rasters** (65 MB ppt + 38 MB tmean GeoTIFF) are NOT in
git; re-download from the FTP paths above if basins outside the
clip window are needed. The prep script
(`scripts/flood-forecasting/prepare-static-attributes.py`) reads
these clipped grids and returns NaN with an honest note when a
basin falls outside the window.
