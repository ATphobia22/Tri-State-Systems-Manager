# USGS Gage Datum Conversions (TSM)

## Core equation

```
WSE_NAVD88 ≈ gage_height_ft + gage_zero_navd88_ft
```

Gage height (NWIS parameter **00065**, NWPS observed primary) is **relative to gage zero**. It is **not** an orthometric NAVD88 elevation until the published gage datum / gage zero is added.

## Why this matters for Bonebank

Site BFE (375.0) and LAG (377.2) are **NAVD88**. Comparing raw gage height (e.g. 11.5 ft) to 375 ft without conversion is a **category error** and can produce false “below BFE” or false “above BFE” findings.

## Published zeros in TSM (`src/lib/gage-datums.ts`)

| ID | Site | Gage zero NAVD88 | Status |
|----|------|------------------|--------|
| 03378500 | Wabash @ New Harmony | **352.71 ft** | Published (USGS) |
| 03322000 | Ohio @ Evansville | **328.38 ft** | Published (NWS table / USGS elev) |
| MTVI3 | Ohio @ Mount Vernon | — | Unpublished in TSM — GAGE_DATUM only |
| UNWK2 / 03322420 | John T. Myers L&D | — | Unpublished — GAGE_DATUM only |

## S-1 policy

1. Raw stage metadata: `vertical_reference: GAGE_DATUM`
2. Converted WSE only when `conversionPublished === true`
3. Evidence artifacts must not stamp NAVD88 on raw 00065 values
4. UI banners must state provisional + non-determination

## References

- USGS Water Data for the Nation site pages
- NWS NWPS vertical datum tables (e.g. EVVI3)
- USGS TM 11-B8 vertical datum conversion process (regional methods overview)
