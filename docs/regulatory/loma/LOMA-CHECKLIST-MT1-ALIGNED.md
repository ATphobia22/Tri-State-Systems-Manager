# LOMA Checklist — Aligned to MT-1 / MT-EZ Instructions

**Sources (extracted 2026-10-06):**
`~/workspace/tsm-forms/flood/FEMA-MT-EZ-Application-Form.doc`
(DHS/FEMA; form copy expired 2014-02-28 — re-acquire current edition before reliance).
The MT-1 application-forms PDF, MT-1 2021 instructions PDF, MT-1 fee-info PDF,
and MT-EZ 2021 instructions PDF did **not** download correctly (viewer
screenshots, not the forms) and are NOT used below.

**Posture:** reference checklist only. No filing is authorized. Button-only /
fail-closed telemetry rules apply; missing items are `UNAVAILABLE`, never
assumed present.

## MT-EZ vs full MT-1 — which path

Per the MT-EZ form text:

- **MT-EZ (simplified):** single structure or single legally recorded parcel of
  land (or portion thereof) on **natural grade**, requesting removal from the
  SFHA via LOMA.
- **Full MT-1 required instead** if: "fill been placed on your property to raise
  ground that was previously below the BFE? If Yes, STOP!! You must complete
  the MT-1 application forms."
- MT-EZ determinations are made under the NFIP regulations ("Applicable
  Regulations… presented in the National Flood Insurance Program (NFIP)
  reg[ulations]") with a stated "Basis of Determination" section on the form.

## Required supporting documents (verbatim requirements)

1. **Subdivision plat map** — copy "with recordation data and stamp of the
   Recorder['s Office]".
2. **Property deed** — copy "with recordation data and stamp of the Recorder['s
   Office]".
3. **Tax assessor map or other certified map** — "showing the surveyed location
   of the property relative to local streets".
4. **Map standards** — "Please include a map scale and North arrow on all maps
   submitted."
5. **Elevation Certificate** — completed for the structure (referenced as part
   of the determination basis; see `EC-FIELD-SCHEMA.md`).
6. **Professional seal** — the survey portion "must be completed by a
   registered professional engineer or licensed land surveyor" and "is to be
   signed and sealed by a licensed land surveyor, registered professional
   engineer, or architect". "Incomplete submissions will result in processing
   delays."

## Data items to collect

- [ ] Determination target: structure vs. legally recorded parcel/portion
- [ ] Construction date (MM/YYYY)
- [ ] Fill history: any fill placed to raise ground previously below BFE?
      (Yes → MT-1 path, not MT-EZ)
- [ ] Structure street address (incl. apt/unit/bldg)
- [ ] Construction type: crawl space / slab on grade / basement-enclosure / other
- [ ] Coordinates of the **most upstream edge of the structure**, decimal
      degrees to the 5th decimal place; datum WGS84 / NAD83 / NAD27
- [ ] Property description: lot/block, tax parcel number, or abbreviated
      description from the deed
- [ ] LAG: elevation of the lowest ground touching the structure (structure path)
      — *awaiting licensed surveyor; currently UNAVAILABLE*
- [ ] Parcel path: elevation of the lowest ground on the parcel/portion to be
      removed from the SFHA — *awaiting licensed surveyor; currently UNAVAILABLE*
- [ ] Applicant block: name (required), email (optional), mailing address
      (required), daytime phone (required), fax (optional), signature + date
      (required); 18 USC §1001 false-statements warning acknowledged

## Fees

The MT-1 fee-information PDF did not download correctly; no fee figures are
stated here. Verify current LOMA/LOMR fee schedule at fema.gov before any
planning use.

## Known gaps vs the existing drive-import checklist

- `docs/regulatory/loma/loma-package-checklist.md` cites "Section 35" (the
  working section is 8; the verified APN embeds "08") and uses "MSL" where the
  forms require an explicit vertical datum (NAVD88 in TSM practice).
- FEMA's Additional Information request on case 26-05-2022A (recorded
  deed/plat, tax assessor map, certified elevation documentation) is consistent
  with items 1–3 and 6 above — the federal ask matches the form requirements.
