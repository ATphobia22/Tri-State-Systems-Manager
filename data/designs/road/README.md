# Road Conceptual Designs — Posey County, Indiana

> **CONCEPTUAL — NOT FOR CONSTRUCTION. REQUIRES LICENSED PROFESSIONAL ENGINEER (PE) REVIEW.**
>
> These are planning-level conceptual designs only. They are not certified
> engineering, not a regulatory determination, and not a FEMA submission.
> All elevations, alignments, volumes, and costs are approximate and must be
> verified by a licensed PE with field survey, geotechnical investigation,
> and hydraulic modeling before any use.

## Design basis

- **Reference datum:** NAVD88 (all elevations in feet).
- **Current FIS reference BFE:** 369.1 ft NAVD88 per FEMA FIS 18129CV000A Table 9, Section A. The older 375.0 ft value is a superseded working target.
- **Use gate:** The project AOI, panel-to-parcel relationship, LAG, horizontal CRS, and vertical datum must be independently reconciled before any design or regulatory use.
- **Anchor reference:** 37.845887, −88.005075 (13101 Bonebank Road, Point Township).
- **Design intent:** keep the traveled way passable at or above BFE plus
  freeboard during the 1%-annual-chance event, so residents and emergency
  vehicles are not cut off. Raising a road in the floodplain changes
  conveyance — a no-rise analysis and floodway check are mandatory.
- **Alignments are approximate** planning-level polylines, not surveyed.

## Typical cross-section (raised rural roadway)

```
        <-- traveled way + shoulders -->
      _________________________________
     /|                               |\
    / |    aggregate base + asphalt   | \
   /  |_______________________________|  \   side slopes: 4H:1V (side_slope_hv = 4)
  /                                       \
-/-----------------------------------------\-
 existing grade                        existing grade
```

- Embankment cross-sectional area (trapezoid): `A = h × (top_width + side_slope_hv × h)`
- Earthwork volume: `V = A × length_ft / 27` (CY), plus 20% shrinkage/waste.
- Pavement: 6-inch aggregate base + 3-inch hot-mix asphalt over the raised grade
  (conceptual; pavement design by PE per county standards).
- Side slopes 4H:1V for roadway embankments (flatter than berms for vehicle safety
  and maintenance).

## Cost-estimate methodology (planning level, 2026 dollars)

Unit costs are *methodology inputs*, not bids.

| Item | Planning unit | Notes |
|---|---|---|
| Roadway embankment, compacted | $20–$28 / CY | Borrow, haul, placement, compaction |
| Aggregate base (6 in) | $18–$25 / SY | Per square yard of roadway |
| Hot-mix asphalt surface (3 in) | $28–$40 / SY | Per square yard of roadway |
| Driveway/field-entrance reconnection | $2,500–$6,000 each | Grade tie-ins |
| Culvert extensions / replacements | $15,000–$40,000 each | Maintain cross-drainage |
| Engineering & permitting | 15% of construction | Survey, geotech, H&H, design |
| Contingency | 25% | Conceptual-level uncertainty |

Worked example — `bonebank-road-elevation`:
- A = 5.5 × (20 + 4×5.5) = 231 sq ft; V = 231 × 1,800 / 27 ≈ 15,400 CY;
  borrow ≈ 18,500 CY with 20% shrinkage.
- Earthwork ≈ 18,500 × $24 ≈ $444,000; pavement ≈ (20 ft × 1,800 ft / 9)
  = 4,000 SY × ($22 + $34) ≈ $224,000; reconnections/culverts ≈ $60,000;
  subtotal ≈ $728,000; + 15% engineering ≈ $109,000; + 25% contingency ≈
  $209,000 → **planning-level range ≈ $950,000–$1,100,000**.

## Regulatory gates (all open)

`no_rise_required: true`, `floodway_check_required: true`,
`wetland_check_required: true`, `property_rights_verified: false`,
`utility_conflicts_checked: false`. Raising a road in the SFHA/floodway
requires IDNR floodway permitting and, where applicable, a FEMA CLOMR —
none applied for.

## Files

| File | Description |
|---|---|
| `bonebank-road-elevation.json` | ~1,800 ft raise of Bonebank Road segment, surface 378.5 ft NAVD88 |
| `point-township-evacuation-route.json` | ~3,200 ft evacuation-route raise, surface 378.0 ft NAVD88 |
| `geometry/*.geojson` | Approximate planning alignments (EPSG:4326), not surveyed |

All JSON files validate against `data/schemas/road-berm-scenario.schema.json`.
