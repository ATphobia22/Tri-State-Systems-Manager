# Critical Facilities — Posey County

**Acquired:** 2026-10-17
**Scope:** Posey County, IN bbox [-88.25, 37.75, -87.75, 38.20]

## Sources

| Dataset | Source | Vintage | Posey count |
|---------|--------|---------|-------------|
| Fire stations | NERIS Public (USFA/FSRI), live daily | 2026-10-17 | 15 |
| Fire departments | NERIS Public (USFA/FSRI), live daily | 2026-10-17 | 14 |
| Hospitals | HIFLD (ORNL/DHS) | 2026-10-17 query | 0 in Posey* |

\* No HIFLD hospitals within Posey County boundaries. Nearest hospitals are in Evansville (Vanderburgh County). This is expected for a rural county — documented as zero, not missing.

## HIFLD status note

HIFLD Open (hifld-geoplatform.opendata.arcgis.com) went offline August 2025. Data archived by Data Rescue Project in DataLumos. Individual agency endpoints remain live:
- Hospitals: `services1.arcgis.com/CD5mKowwN6nIaqd8/.../HVRA_Source_Data_Hospitals/FeatureServer`
- Fire: **NERIS Public** replaced HIFLD fire stations Dec 2025 — live, daily updated: `services5.arcgis.com/lPbcyJOcoLyZmvo6/.../NERIS Public Fire Departments/FeatureServer`

## Files

- `posey-fire-stations-neris-2026-10-17.geojson` — 15 station points
- `posey-fire-departments-neris-2026-10-17.geojson` — 14 department points
- `posey-hospitals-hifld-2026-10-17.geojson` — empty (0 features, verified)

## Authority

SCREENING / reference only. Facility locations from federal open data; verify with local agencies for operational use.
