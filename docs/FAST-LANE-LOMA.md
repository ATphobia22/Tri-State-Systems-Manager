# Fast-Lane LOMA Additional-Information Checklist

Expedited completeness checker for a FEMA LOMA/LOMR additional-information
response package. Built from the local floodplain admin packet for FEMA case
**26-05-2022A** (additional-information letter 2026-09-22; 90-day response
track ends **2026-12-21**; LOMA **not** issued).

## What it does

`tools/validation/fastlane_loma_checklist.py` reads a response package
directory (`case.json` manifest + artifact files) and checks each item from
the FEMA additional-information checklist:

1. Recorded deed/plat present
2. Tax assessor map present (with street intersection shown on the FIRM panel)
3. PE/RLS-certified elevation documentation present, certified, and not
   expired (MT-1 Form 2 / Elevation Certificate)
4. Written FEMA confirmation of the accepted form/procedure present
5. Original FEMA PDF preserved byte-identically (SHA-256 vs control hash)

It also computes deadline math: days remaining on the 90-day track and
whether the track is OPEN or EXPIRED.

The overall verdict is **READY** only when every item is PASS. Any FAIL or
MISSING item yields **NOT_READY** (fail-closed; exit code 1).

## Usage

```bash
# See the expected case.json schema
python3 tools/validation/fastlane_loma_checklist.py --print-schema

# Validate a package (deadline math defaults to today)
python3 tools/validation/fastlane_loma_checklist.py ./response-packages/26-05-2022A/

# Pin the reference date (reproducible deadline math)
python3 tools/validation/fastlane_loma_checklist.py ./response-packages/26-05-2022A/ --as-of 2026-09-26
```

## Limits (read before using)

- **Completeness, not sufficiency.** This tool checks that the expected
  documents are present, intact, and (for elevation docs) certified and
  unexpired. It does **not** determine whether any document satisfies FEMA
  requirements — only FEMA does.
- **Not legal advice.** Nothing here is a legal instrument or a filing
  strategy. Coordinate with the floodplain administrator and, where required,
  a licensed professional.
- **Human authority remains final.** A READY verdict means "package is
  complete per the checklist," not "approved." A human reviews and submits.
- The case constants (case id, letter date, deadline) come from the
  locally-preserved admin packet; if FEMA issues new correspondence, update
  the manifest — do not edit the tool to assume facts.

## Tests

```bash
python3 -m pytest tools/validation/tests/test_fastlane_loma_checklist.py -v
```
