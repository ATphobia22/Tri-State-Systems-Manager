# HEC-RAS Model 4449 — Vertical Datum: Correct Answer

**Date:** 2026-10-18
**Finding:** The vertical datum is **NGVD29** (National Geodetic Vertical Datum of 1929).

## Direct Evidence

From `JTMyers.prj` (the HEC-RAS project file), BEGIN DESCRIPTION block:

```
UNIONTOWN POOL - MILE 846 TO MILE 773     (File Name = ouniFW01)
      1929 DATUM (NGVD) - 1976 DISCHARGES  (NAT, 0.0, 0.1, 0.5 & 1.0)
      100 YEAR                 NATURAL
```

This is explicit, direct evidence from the model's own authoritative file.
"1929 DATUM (NGVD)" unambiguously identifies NGVD29.

## Correction to Prior Withdrawal

Commit 3aa0115d ("docs: withdraw unsupported HEC-RAS execution approval")
stated that "the bounded archive scan did not find explicit vertical-datum
evidence." That scan was incomplete — it missed the DESCRIPTION block in
JTMyers.prj. The datum evidence was present in the archive all along.

## What This Means

- Model 4449 elevations are in **NGVD29**, not NAVD88.
- The ~0.213 m (0.7 ft) NGVD29→NAVD88 conversion used in the flood layer
  code is grounded in this finding.
- The "Datum warning · NGVD29" card in the console was correct and does
  not need correction.
- This datum finding does NOT reinstate execution approval. The withdrawal
  of the "APPROVED for technical execution" wording stands on its other
  grounds (no qualified human review, unvalidated spatial reference,
  unconfirmed boundary conditions). Datum identification is necessary but
  not sufficient for approval.

## Verification

```bash
unzip -p model-4449-JTMyers-FIS.zip JTMyers.prj | grep -A3 "BEGIN DESCRIPTION"
```
