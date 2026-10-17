# NFHL registry validation (2026-10-17)

## Documentation alignment

FEMA published NFHL themes (zones, river mile markers, cross sections, coastal transects, LOMR/FIRM boundaries, community boundaries, levees, hydraulic structures, profile baselines, LiMWA) **match** the thematic inventory in this registry.

FEMA identifies the NFHL as the **authoritative geospatial database** for effective flood hazard mapping and Letters of Map Change. TSM treats digital NFHL as **REGULATORY_DISPLAY**; hardcopy FIRM+FIS control conflicts.

## Live MapServer verification

Queried `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson` on **2026-10-17**:

- **32** layers returned
- Numeric **IDs and names** match this registry exactly (including gaps at 2, 21, 33 — not present on service)

## Priority operational stack (PTDT / Twin)

```text
28 Flood Hazard Zones
27 Flood Hazard Boundaries
16 Base Flood Elevations
23 Levees
34 LOMAs
3  FIRM Panels
22 Political Jurisdictions
32 Water Areas
```
