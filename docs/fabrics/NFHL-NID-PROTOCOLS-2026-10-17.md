# FEMA NFHL exploration + NID dam safety protocols (2026-10-17)

## FEMA NFHL (effective)

**Service:** `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`

| Layer ID | Name | Posey (DFIRM_ID LIKE '18129%') |
|----------|------|--------------------------------|
| 28 | Flood Hazard Zones | live (prior count 123) |
| 16 | Base Flood Elevations | **21** |
| 3 | FIRM Panels | live |
| 1 | LOMRs | **0** |
| 34 | LOMAs | live |
| 23 | Levees | live |

**Protocol for TSM**

- Effective NFHL = **REGULATORY display** only (44 CFR mapping). Hardcopy FIRM+FIS remain controlling when they conflict with digital.
- Preliminary / CSLF = **CONTEXT** — never label as effective SFHA.
- LOMA/LOMR layers inform map changes; case 26-05-2022A remains human-gated.

## NID dam safety protocols

**Authoritative inventory:** USACE NID — https://nid.sec.usace.army.mil/

**Working API (fixed)**

```
GET https://nid.sec.usace.army.mil/api/query?sy=@stateKey:IN&addProps=all
GET https://nid.sec.usace.army.mil/api/query?nr={lon},{lat},{radius_miles}&addProps=all
GET https://nid.sec.usace.army.mil/api/dams/{nidId}/inventory
```

**Posey County (official API, 2026-10-17):** **5 dams**

| Name | NID ID | Hazard | Lat | Lon |
|------|--------|--------|-----|-----|
| A.B. Brown Power Plant | IN00516 | High | 37.9026 | -87.7124 |
| Harold Mann Lake Dam | IN03354 | Low | 38.0600 | -87.7018 |
| Pahoka Camp Lake Dam | IN00397 | Low | 38.0505 | -87.9785 |
| Koester Lake Dam | IN00631 | Low | 38.1159 | -87.7033 |
| Willow Marsh Dam | IN03797 | Low | 37.8103 | -87.9253 |

**Safety protocol meanings (inventory-level)**

| Concept | Meaning for TSM |
|---------|-----------------|
| Hazard potential | High / Significant / Low — downstream consequence class, **not** structural condition |
| EAP | Expected for High (often Significant); NID tracks EAP presence |
| Condition assessment | Fair / Poor / etc. when reported |
| State regulated | Indiana DNR Dam Safety for non-federal dams |
| NID role | **Awareness inventory** — not inundation maps, not EAPs, not SCADA |

**TSM authority:** NID = **CONTEXT**. Never REGULATORY structure safety without agency documents.

## IGIO API fix

| Broken | Fixed |
|--------|-------|
| `Hosted/Building_Footprints_of_Indiana_2016_2020` (404) | `Hosted/Building_Footprints` → **16,116** in Posey envelope |

Prefer TSM `buildings-3d.json` for height-enabled Twin; IGIO footprints = CONTEXT outlines.
