# TSM 12-Layer Structural Pipeline Fabric v1

## Canonical frame

The engineering source frame is **EPSG:2966 (NAD83 / Indiana West, US survey feet)** with vertical engineering calculations recorded against **NAVD88**. MapLibre renders its browser scene in Web Mercator (EPSG:3857); it must not silently relabel Web Mercator coordinates as EPSG:2966.

Each structural plane retains independent source authority, CRS, vertical-datum metadata, retrieval/provenance state, and rendering eligibility.

## Twelve planes

| # | Plane | Runtime role |
|---|---|---|
| 01 | Continuous Terrain-RGB DEM Engine | MapLibre terrain mesh / UE terrain foundation |
| 02 | Verified Hydrographic Bathymetry Mappings | Hydrographic cross-section/context plane |
| 03 | Vertical NAVD88 Gage-Zero Conversion Mesh | Datum middleware; engineering computation |
| 04 | HEC-RAS 2D Hydro-Geometry Mesh Centroids | Hydraulic result/evidence plane |
| 05 | FEMA NFHL Effective Special Hazard Zones | Effective regulatory reference |
| 06 | Indiana DNR Best Available Flood Planes | State planning/reference plane |
| 07 | USGS StreamStats Peak Inundation Cores | Hydrologic scenario inputs/results |
| 08 | Indiana Parcel Vector Fabric | Public parcel context |
| 09 | 3D Photorealistic Building Extrusions | Reference visualization geometry |
| 10 | Live Hydrologic Gauge Stream Matrix | Observational telemetry |
| 11 | Conditional USACE Sec 204 Placement Enclaves | Scenario/engineering placement plane |
| 12 | Cinematic Volumetric Mist Grid | Presentation-only client effect |

## Rendering boundary

### MapLibre

MapLibre is the interactive geospatial inspection plane:

- Terrain-RGB elevation
- regulatory/reference rasters
- bounded GeoJSON feature queries
- building extrusion
- layer visibility and provenance inspection

### Unreal Engine 5.8

UE5.8 is the cinematic/open-world rendering boundary:

- Nanite terrain/foliage/building assets
- Lumen lighting/reflections
- physically based water/mud materials
- deterministic environmental overlays
- Cine Camera / MRQ / Path Tracer output

External heavy solvers remain isolated behind worker/capability contracts. Rendering code cannot mutate engineering evidence.

## Hydrologic presentation invariant

For any accepted gauge datum record:

$$
WSE_{NAVD88}=GageHeight+ValidatedGageZero_{NAVD88}
$$

The transformation is an engineering middleware operation. The cinematic water/mud material consumes the resulting validated WSE; it does not calculate or alter the datum conversion.

## Fail-closed rules

1. Missing Terrain-RGB data disables terrain elevation rendering rather than substituting an unverified DEM.
2. FEMA NFHL and Indiana Best Available products remain separate authority classes.
3. API/scenario planes cannot be treated as direct MapLibre tiles.
4. Presentation effects cannot alter engineering values.
5. Gauge data unavailable upstream remains unavailable; the client must never synthesize a live observation.
6. HEC-RAS and Section 204 results require their existing evidence/authorization gates.
7. CRS and vertical datum transformations are explicit provenance events.

## Source evidence

The USACE National Levee Database service exposes a Cross Sections feature layer with Z-enabled geometry and GeoJSON/JSON query support. https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/MapServer/9

USGS StreamStats provides an Indiana regional information portal and hydrologic analysis workflow. https://streamstats.usgs.gov/ss/?information-portal=regionalInformation&region=IN
