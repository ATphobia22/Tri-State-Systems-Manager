# Indiana DNR Effective Flood Cross-Sections

**Source:** Indiana Department of Natural Resources, Division of Water
**Files:**
- `FLOOD_XS_EFFECTIVE_DNR.csv` (908 records, 135 KB)
- `FLOOD_XS_EFFECTIVE_DNR_PROD.geojson` (908 features, 698 KB)

## Contents

908 flood cross-sections for Posey County, Indiana (DFIRM 18129C), with regulatory water surface elevations.

### Key Fields

| Field | Description |
|-------|-------------|
| `stream_stn` | Stream station (river mile for Ohio River) |
| `xs_ltr` | Cross-section letter (A–L for Ohio River) |
| `wtr_nm` | Waterway name |
| `wsel_reg` | **Regulatory water surface elevation (ft NAVD88)** |
| `strmbed_el` | Streambed elevation (-8888 = not surveyed) |
| `xsarea100` | Cross-sectional area (sq ft) |
| `v_datum` | Vertical datum (NAVD88) |
| `source_dnr` | Source: `NFHL` (detailed), `IDNR_ZONEA` (approximate) |
| `xs_ln_typ` | `LETTERED, MAPPED` (regulatory) or `NOT LETTERED, NOT MAPPED` |

### Ohio River Cross-Sections (12 lettered, from NFHL)

| Letter | River Mile | WSEL (ft NAVD88) | Distance from Anchor |
|--------|-----------|------------------|---------------------|
| A | 844.75 | 369.1 | 0.46 mi |
| B | 841.0 | 369.8 | 1.16 mi |
| C | 839.0 | 370.2 | 2.82 mi |
| D | 838.0 | 370.4 | 2.20 mi |
| E | 836.0 | 370.6 | 2.81 mi |
| F | 834.5 | 370.7 | 3.47 mi |
| G | 833.0 | 371.0 | 4.49 mi |
| H | 831.0 | 371.0 | 6.41 mi |
| I | 830.25 | 371.1 | 7.18 mi |
| J | 828.75 | 371.9 | — |
| K | 827.25 | 372.2 | — |
| L | 826.0 | 372.3 | — |

### ⚠️ BFE Discrepancy Note

The regulatory WSEL values at the nearest cross-sections (369.1–369.8 ft NAVD88) are **5–6 ft below** the BFE 375.0 ft working target for the anchor site.

**Possible explanations (not resolved):**
- The BFE 375.0 may apply upstream of J.T. Myers Dam (RM 846.2); these sections are in the dam tailwater
- The site at RM ~846 sits between the dam and Section A (RM 844.75)
- Dam pool/tailwater hydraulics create a discontinuity

**Do NOT change the working BFE based on this data alone.** Resolving this requires hydraulic analysis accounting for the dam. The INFIP FARA report remains the authoritative path to a site-specific BFE.

### Usage

```python
import csv
with open('FLOOD_XS_EFFECTIVE_DNR.csv') as f:
    rows = list(csv.DictReader(f))
    ohio = [r for r in rows if r['wtr_nm'] == 'OHIO RIVER']
```

Or load the GeoJSON directly in GIS software for spatial analysis.

### Provenance

- Authority: Indiana DNR Division of Water (effective floodplain data)
- DFIRM: 18129C (Posey County, effective 2014-11-05)
- Vertical datum: NAVD88
- Acquired: 2026-10-18 via user upload
- Status: OBSERVED (government-published effective data)
