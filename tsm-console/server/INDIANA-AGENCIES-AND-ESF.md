# Indiana Agencies · IGWS · ESF Mapping — Verified 2026-08-19

## IGIO / GIS (https://www.in.gov/gis/)

Programs: IndianaMap, **Data Harvest**, Imagery, Elevation, Enterprise GIS.

**Preferred “Current” FeatureServers** (auto-refresh annually):

| Layer | URL |
|-------|-----|
| Address Points Current | `.../Hosted/Address_Points_of_Indiana_Current/FeatureServer` |
| Road Centerlines Current | `.../Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer` |
| Parcel Boundaries Current | `.../Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer` |
| Administrative Boundaries Current | `.../Hosted/Administrative_Boundaries_of_Indiana_Current/FeatureServer` |
| State Geocoder | `.../Geocode/State_Geocoder_MultiRole_WGS84/GeocodeServer` |

Year-stamped services archived for historical snapshots.

## INDOT · 511

- INDOT: https://www.in.gov/indot/
- Traveler info: https://511in.org/ — road conditions, incidents (ESF #1 Transportation context)
- Use as operational situational awareness; not flood regulatory authority

## IGWS (Indiana Geological and Water Survey)

- Search/data: https://data.igws.indiana.edu/ · https://igws.iu.edu/
- **GDMS** (Geological Database Management System): subsurface, water wells, stratigraphy, coal, petroleum
- Contributes geologic layers toward IndianaMap; hazard/resource stewardship
- TSM: subsurface/hydrogeology context for Scientific Plane — not a substitute for FEMA/DNR floodplain

## State forms & directories

| Resource | URL | Use |
|----------|-----|-----|
| forms.in.gov Agency list | https://forms.in.gov/Agencylist.aspx | Form discovery |
| Access Indiana directory | https://in.accessgov.com/indiana/Home/Directory | Agency services |
| USA.gov Indiana | https://www.usa.gov/states/indiana | Federal–state portal |
| Police directory (third-party) | https://www.usacops.com/in/pollist.html | Reference only — verify against official sources |

## FEMA ESF ↔ TSM plane mapping (Response Framework)

| ESF | Name | TSM relevance |
|-----|------|----------------|
| 1 | Transportation | 511in, INDOT layers |
| 2 | Communications | Trust Fabric / status |
| 3 | Public Works & Engineering | HEC-RAS, levees, berms |
| 4 | Firefighting | Local response context |
| 5 | Information and Planning | Evidence Ledger, EOC console |
| 6 | Mass Care / Human Services | Human Needs Graph |
| 7 | Logistics | Benefit / resource routing |
| 8 | Public Health | MPH hub context (no PHI) |
| 9 | Search and Rescue | — |
| 10 | Oil & HazMat | — |
| 11 | Agriculture & Natural Resources | NASS, ISDA, IGWS |
| 12 | Energy | — |
| 13 | Public Safety | Local law enforcement directories |
| 14 | Cross-Sector Business & Infrastructure | Critical infrastructure profile |
| 15 | External Affairs | Public accountability UI |

TSM **informs** ESF-aligned planning; it does not replace ICS/EOC authority.

