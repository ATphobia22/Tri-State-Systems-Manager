# Gage Datum and Stage

## Problem

A reported gage stage is not an elevation. Stage is measured relative to
the gage datum, and only becomes a NAVD88 elevation after a validated
gage-zero conversion:

```
Water Surface Elevation (ft NAVD88) = Stage (ft) + Gage Datum (ft NAVD88)
```

Unknown until both the gage datum and the vertical datum are validated.

## Verified gage datums (parent-verified, 2026-10-24)

| Station | Name | Gage datum (ft NAVD88) |
|---|---|---|
| 03378500 | Wabash River at New Harmony, IN | 352.71 |
| 03381700 | Ohio River at Old Shawneetown, IL | 309.10 |
| 03322000 | Ohio River at Evansville, IN | 328.32 |
| 03304300 | Ohio River at Newburgh, IN | 329.20 |
| 03377500 | Wabash River at Mt. Carmel, IL | 368.98 |

Implementation: `backend/governance/site_constants.py`,
`backend/evidence/gage_datum.py` (TypeScript counterpart:
`packages/gates/src/index.ts` `convertGageHeightToNavd88`).

## Worked example

Stage 15.0 ft at 03378500 → WSE = 352.71 + 15.0 = **367.71 ft NAVD88**.

## Validation rule

Missing datum → `UNAVAILABLE`. Wrong vertical datum → `UNAVAILABLE`
(`DATUM_MISMATCH`). Non-finite stage → `UNAVAILABLE`. The function never
raises for a missing datum and never returns an estimated elevation
(resilient policy; fail-closed is banned).

## Known discrepancy (flagged, not hidden)

`tsm-console/src/lib/gage-datums.ts` (2026-10-15) records a 352.67 ft
CANDIDATE gage-zero relationship for 03378500 from USGS SIR 2016-5119 with
an unclosed product-semantic conflict, and marks conversion unpublished.
The 352.71 ft value above is the parent-verified datum. The discrepancy is
open for reconciliation; the TS file's caution is not silently overwritten.
Station altitudes (e.g. Evansville's 328.32 ft land-surface altitude) are
never silently treated as parameter-00065 gage-zero conversions.

## Required metadata on every conversion

Station ID, gage datum, vertical datum (NAVD88), conversion method, and
reference epoch. A conversion without all five is `UNAVAILABLE`.
