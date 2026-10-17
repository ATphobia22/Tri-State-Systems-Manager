# FEMA NFHL layer types

**Service:** `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`

| ID | Name | Geometry | Key fields | TSM authority |
|----|------|----------|------------|---------------|
| 0 | NFHL Availability | Polygon | STUDY_ID | CONTEXT |
| 28 | Flood Hazard Zones | **Polygon** | FLD_ZONE, SFHA_TF, STATIC_BFE, ZONE_SUBTY | **REGULATORY display** |
| 27 | Flood Hazard Boundaries | Polygon | zone edges | REGULATORY display |
| 16 | Base Flood Elevations | **Polyline** | ELEV, V_DATUM, LEN_UNIT | REGULATORY display |
| 3 | FIRM Panels | **Polygon** | FIRM_PAN, EFF_DATE, PANEL | REGULATORY display |
| 1 | LOMRs | **Polygon** | CASE_NO, EFF_DATE, STATUS | REGULATORY / case |
| 34 | LOMAs | **Point** | CASENUMBER, LAT, LON, STATUS | REGULATORY / case |
| 23 | Levees | **Polyline** | LEVEE_NM, FC_SYS_ID, USACE_LEV | REGULATORY / NLD cross-ref |
| 14 | Cross-Sections | Polyline | study XS | CONTEXT |
| 17 | Profile Baselines | Polyline | — | CONTEXT |
| 20 | Water Lines | Polyline | — | CONTEXT |
| 32 | Water Areas | Polygon | — | CONTEXT |
| 22 | Political Jurisdictions | Polygon | — | CONTEXT |
| 24 | General Structures | Point/line | — | CONTEXT |
| 10 | Gages | Point | — | CONTEXT |
| 12 | High Water Marks | Point | — | CONTEXT |

## Local maps (project artifacts)

- `04_flood/maps/posey-nfhl-map.html` — live NFHL export with layer toggles
- `04_flood/maps/posey-area-map.html` — area overview + NID dams
- `04_flood/maps/posey-dam-danger-map.html` — dam hazard screening

Hardcopy FIRM + FIS remain controlling if digital and paper conflict (44 CFR).
