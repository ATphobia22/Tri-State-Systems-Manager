# External Data Acquisition — What Code Can and Cannot Do

| Item | Can TSM download? | Path |
|------|-------------------|------|
| TR-22-4 / ERDC | No (FOIA by requester) | ERDC catalog → USACE FOIA |
| CEII | **No — refuse** | FERC CEII + NDA only |
| PE/PLS | No | Licensed human seal |
| Union KY PVA | Partial public/commercial | ArcGIS / PVA office |
| Live 811 | No open bulk API | Member API key or manual ticket |
| INDOT | Public GIS REST | e.g. INDOT_NLRI MapServer |
| LoD2/3 LiDAR | Yes (3DEP) | LidarExplorer + AWS EPT + PDAL |

## CEII
Never download/store via TSM. `cim_ceii` empty in public.

## 3DEP LoD path
1. https://www.usgs.gov/tools/lidarexplorer
2. EPT: s3 usgs-lidar-public
3. `scripts/geospatial/pdal_3dep_clip.json` → EPSG:26916 DEM
4. DSM−DEM heights → LoD1/2; LoD3 needs MLS/IFC

## 811
indiana811.org ticket request; memberservices@indiana811.org for JSON API key.
