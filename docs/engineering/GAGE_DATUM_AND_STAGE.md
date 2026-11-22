# Gage Datum and Stage

## Problem

A reported gage stage is not an elevation. Stage is measured relative to
the gage datum, and only becomes a NAVD88 elevation after a validated
gage-zero conversion:

```
Water Surface Elevation (ft NAVD88) = Stage (ft) + Gage Datum (ft NAVD88)
```

Unknown until both the gage datum and the vertical datum are validated.

## Discovered station altitudes versus reviewed gage zeros

The following numbers appear in prior data discovery and are **not an
approved conversion table**. The source/product semantics differ.

| Station | Site | Historical reference elevation (ft NAVD88) | Conversion status |
|---|---|---:|---|
| 03378500 | Wabash at New Harmony, IN | Site altitude 352.71; candidate gage zero 352.67 | **WITHHELD**: published candidate and station altitude are different quantities; effective epoch and independently reviewed gage-zero tie are unresolved |
| 03381700 | Ohio at Old Shawneetown, IL | 309.10 station reference | **WITHHELD** |
| 03322000 | Ohio at Evansville, IN | 328.32 station altitude | **WITHHELD** |
| 03304300 | Ohio at Newburgh, IN | 329.20 station reference | **WITHHELD** |
| 03377500 | Wabash at Mt. Carmel, IL | 368.98 station reference | **WITHHELD** |

The separate `backend/governance/site_constants.py` module deliberately has
`GAGE_DATUMS_FT_NAVD88 = {}`. The app must not derive NAVD88 WSE from
the station-altitude discovery table. Even if a historical project memo
lists a candidate value, do not imply that current parameter 00065 time
series and an old vertical datum are reconciled.

**Illustrative mathematics only**: stage 15.00 ft plus an assumed gage zero
352.67 ft would equal 367.67 ft NAVD88; using 352.71 yields 367.71 ft.
These are **different calculations based on different assumptions**;
neither is an approved observed water-surface elevation until the station
gage-zero and reference epoch are independently established.

## Required engineering checks

Obtain actual station-specific USGS datum/benchmark metadata with source URI,
acquisition timestamp, gage-zero value, survey method, vertical datum,
uncertainty, effective date interval, independent review and original byte
hash. Prove the applicable current observation time falls inside that interval,
then enforce the correct datum in the selected HEC-RAS result geometry.
The USGS policy https://water.usgs.gov/water-resources/memos/memo.php?id=4447
provides datum establishment standards, including an applicable 0.16 ft
(0.05 m) two-sigma geodetic vertical accuracy requirement; this **does not**
authorize using 0.16 ft as the allowed complete hydraulic-model residual.

Missing, conflicting, or unpublished datum evidence causes **only the WSE
conversion** to be unavailable. The raw timestamped stage can still be
displayed and the viewer continues operating.

## Required metadata on every conversion

Station ID, gage datum, vertical datum (NAVD88), conversion method, and
reference epoch. A conversion without all five is `UNAVAILABLE`.
