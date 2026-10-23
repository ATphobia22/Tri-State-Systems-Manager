# Vertical Datum — Authoritative Reference (2026-10-23)

Authoritative sources: NGS (National Geodetic Survey), FEMA, geodesy references.
Compiled for TSM/CRS evidence context.

## What a vertical datum is

A vertical datum is the zero-elevation reference surface for heights (terrain, water
surface, structures). Mixing datums without a published transform makes BFE, LAG,
FFE, and gage stage comparisons invalid.

## Height types (do not conflate)

| Symbol | Name | Reference surface | Typical source |
|--------|------|-------------------|----------------|
| H | Orthometric height | Geoid ≈ mean sea level | Surveys, FIRMs, NAVD88 |
| h | Ellipsoidal height | Mathematical ellipsoid | GNSS / GPS |
| N | Geoid height (undulation) | Ellipsoid → geoid | GEOID models |

Relation (common form): **h = H + N** (or H = h − N, depending on sign convention for N).

Engineering and flood work need orthometric heights on a named vertical datum —
not raw GPS ellipsoidal heights alone.

## US national vertical datums

| Datum | Full name | Role |
|-------|-----------|------|
| NGVD 29 | National Geodetic Vertical Datum of 1929 | Older leveling network; multi-tide-station "sea level" basis |
| NAVD 88 | North American Vertical Datum of 1988 | Current official US vertical datum (NGS); single primary constraint (Father Point / Pointe-au-Père, QC) + expanded leveling |

NGS maintains NAVD 88 and documents relationships to NGVD 29.

## NGVD 29 ↔ NAVD 88 is not a constant

- Difference varies by location (roughly tenths of a foot to several feet across CONUS).
- No single offset is valid nationwide.
- NGS VERTCON (and successors / NCAT) estimates the shift at a lat/lon:
  - Shift convention: reported as (NAVD 88 − NGVD 29)
  - NAVD 88 = NGVD 29 + shift
  - NGVD 29 = NAVD 88 − shift
  - (Keep the algebraic sign.)
- VERTCON is suitable for many mapping uses (~2 cm 1σ in model documentation);
  it is not a substitute for site-specific survey control when regulatory decisions
  require it.

## FEMA / NFIP

- FIS/FIRM flood elevations are tied to a stated vertical datum in the study.
- Older studies often used NGVD 29; newer production uses NAVD 88.
- BFE vs structure elevation is only valid when both use the same datum.
- FEMA issues Vertical Datum Conversion Guidance for map production;
  NGS NCAT is cited for NGVD 29 ↔ NAVD 88.

Tidal datums (MLLW, MHW, etc.) are separate from NAVD 88; CO-OPS publishes ties
to NAVD 88 at tide stations — not the same as NGVD 29 ties.

## TSM alignment (already encoded)

| Rule | Why |
|------|-----|
| Prefer NAVD 88 when labeled | Current national / FEMA practice |
| No silent NGVD 29 ↔ NAVD 88 | Offset is spatial; inventing a constant is false precision |
| Missing vertical datum → MISSING_CRITICAL | Resilient labeling in CRS evidence report |
| Identity-only conversion when labels match | tryDatumConversion returns null across different datums |
| Gage zeros / BFE / LAG must carry explicit datum | Stage and freeboard only comparable in one datum |

Bonebank site constants (BFE 369.1 ft, LAG 377.2 ft) are treated as NAVD 88 in
TSM scientific analytics — presentation and evidence layers must keep that
label visible.

## Authoritative tools / links

- NGS datums FAQ: https://www.ngs.noaa.gov/datums/faq.shtml
- VERTCON sign convention: https://www.ngs.noaa.gov/TOOLS/Vertcon/vert_sign.html
- FEMA vertical datum conversion guidance (Nov 2023 PDF): search FEMA Vertical Datum Conversion Guidance
- FEMA NFHL / FIS: vertical datum section in each study

Human authority remains final. Tools inform elevation math; they do not rewrite
regulatory BFEs or invent transforms.
