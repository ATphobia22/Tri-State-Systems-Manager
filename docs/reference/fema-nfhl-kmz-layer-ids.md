# FEMA NFHL KMZ Layer IDs Reference

Source: `FEMA_NFHL_v3.2.kmz` (official FEMA NFHL Google Earth overlay, v3.2, files dated Feb–Nov 2019)
Extracted: 2026-10-18

## WMS Service Pattern

```
https://hazards.fema.gov/gis/nfhl/services/KMZ/KMZ/MapServer/WmsServer?LAYERS=<id>&...
```

## Layer ID Map

| Layer Name | WMS LAYERS ID | TSM Relevance |
|---|---|---|
| Flood Hazard Zones | 1 | Primary flood zone display |
| Flood Hazard Zone Labels | 2 | Zone labels (AE, X, etc.) |
| Limit of Moderate Wave Action | 4 | Coastal only (N/A for tri-state) |
| Coastal Transect Baselines | 5 | Coastal only |
| Profile Baselines | 6 | FIS profile locations |
| Flood Hazard Boundaries | 7 | SFHA boundaries |
| General Structures | 8 | Bridges, culverts, dams |
| Levees | 9 | **USACE NLD cross-reference** |
| Political Jurisdictions | 10 | County/community boundaries |
| **Base Flood Elevations** | **11** | **BFE point/polylines — visual QA for bfe_ingestion.py** |
| Cross Sections | 13 | **Floodway Data Table cross-sections** |
| Coastal Transects | 12 | Coastal only |
| River Mile Markers | 14 | Ohio/Wabash river miles |
| LOMA | 15 | Letters of Map Amendment |
| LOMRs | 16 | **Letters of Map Revision — check for site** |
| FIRM Panels | 17 | Panel boundaries (18129C) |
| NFHL Availability | 18 | Coverage status |
| CBRS/OPA Units | 0 | Separate USGS service: `cbrsgis.wim.usgs.gov` |

## Usage for TSM

1. **BFE visual QA:** Use Layer 11 (BFE) WMS images as visual cross-check against values parsed from FIS PDFs by `bfe_ingestion.py`
2. **Cross-section QA:** Use Layers 13+12 to verify cross-section locations match `process_fema_s_xs.py` output
3. **LOMR check:** Use Layer 16 to check for map revisions affecting the anchor site (APN 65-19-08-100-008.001-010)

## Staleness Warning

v3.2 is from 2019. FEMA's NFHL service generations have moved on. Verify current endpoint generations before building production tooling on these URLs. The layer IDs are stable across versions but the base URL pattern may change.
