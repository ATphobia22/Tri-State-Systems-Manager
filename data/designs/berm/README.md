# Berm Conceptual Designs — Posey County, Indiana

> **CONCEPTUAL — NOT FOR CONSTRUCTION. REQUIRES LICENSED PROFESSIONAL ENGINEER (PE) REVIEW.**
>
> These are planning-level conceptual designs only. They are not certified
> engineering, not a regulatory determination, and not a FEMA submission.
> All elevations, alignments, volumes, and costs are approximate and must be
> verified by a licensed PE with field survey, geotechnical investigation,
> and hydraulic modeling before any use.

## Design basis

- **Reference datum:** NAVD88 (all elevations in feet).
- **Base Flood Elevation (BFE):** 375.0 ft NAVD88 — a *working target* for the
  anchor site vicinity (FIRM panel 18129C0265C, Zone AE, effective 2014-11-05).
  The effective DFIRM polygon at the anchor carries a null/static BFE; the
  375.0 ft value requires confirmation from the Flood Insurance Study tables
  or an INFIP FARA report before design use.
- **Anchor reference:** 37.845887, −88.005075 (13101 Bonebank Road, Point Township).
- **Alignments are approximate** planning-level polylines, not surveyed. They
  are drawn parallel to the Ohio River bank in the river bottoms west/southwest
  of the anchor. Field survey is required.

## Typical cross-section (earthen berm)

```
              <-- top_width_ft -->
        ___________________________
       /                           \   side slopes: 3H:1V (side_slope_hv = 3)
      /                             \
-----/                               \-----
 existing grade                  existing grade
```

- Cross-sectional area (trapezoid): `A = h × (top_width + side_slope_hv × h)`
- Fill volume: `V = A × length_ft / 27` (cubic yards), plus 20% for
  shrinkage/waste to estimate borrow quantity.
- Assumed average berm height above existing grade: ~6 ft (existing bottomland
  grade ≈ 371–372 ft NAVD88; verify by survey).

## Materials (conceptual)

- Compacted cohesive earth fill (on-site borrow if suitable, otherwise imported clay).
- 12-inch topsoil cap with turf establishment for erosion protection.
- Key trench / cutoff at centerline where seepage analysis requires it
  (to be determined by geotechnical investigation — not performed).
- Turf reinforcement mat or riprap at drainage outfalls and overtopping-prone reaches.
- No design in this package assumes a specific borrow source; a borrow
  investigation is a required next step.

## Cost-estimate methodology (planning level, 2026 dollars)

Unit costs are *methodology inputs*, not bids. Adjust for local market at time of design.

| Item | Planning unit | Notes |
|---|---|---|
| Compacted earth fill, placed | $18–$25 / CY | Includes borrow, haul ≤ 2 mi, placement, compaction |
| Clearing & grubbing | $3,000–$6,000 / acre | Bottomland vegetation |
| Topsoil, seeding & mulching | $4,000–$7,000 / acre | Erosion control establishment |
| Drainage outfalls / culverts | $15,000–$40,000 each | Per crossing, sized by PE |
| Engineering & permitting | 15% of construction | Survey, geotech, H&H, design, bidding |
| Contingency | 25% | Conceptual-level uncertainty |

Worked example — `bonebank-road-residential-berm`:
- A = 6 × (12 + 3×6) = 180 sq ft; V = 180 × 2,400 / 27 ≈ 16,000 CY;
  borrow ≈ 19,200 CY with 20% shrinkage.
- Fill ≈ 19,200 CY × $22 ≈ $422,000; + clearing/seeding/outfalls ≈ $80,000;
  subtotal ≈ $502,000; + 15% engineering ≈ $75,000; + 25% contingency ≈
  $144,000 → **planning-level range ≈ $650,000–$750,000**.

## Regulatory gates (all open)

Every design in this directory carries `constraints` flags. As committed:
`no_rise_required: true`, `floodway_check_required: true`,
`wetland_check_required: true`, `property_rights_verified: false`,
`utility_conflicts_checked: false`. A FEMA Conditional Letter of Map Revision
(CLOMR) and IDNR floodway permit are expected prerequisites for any berm in
the SFHA — none have been applied for.

## Files

| File | Description |
|---|---|
| `bonebank-road-residential-berm.json` | ~2,400 ft residential-protection berm, crest 378.0 ft NAVD88 |
| `point-township-agricultural-berm.json` | ~5,280 ft agricultural-protection berm, crest 377.0 ft NAVD88 |
| `geometry/*.geojson` | Approximate planning alignments (EPSG:4326), not surveyed |

All JSON files validate against `data/schemas/road-berm-scenario.schema.json`.
