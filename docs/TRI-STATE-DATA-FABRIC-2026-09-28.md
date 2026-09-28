# TSM Tri-State River Valley Data Fabric — 2026-09-28

## Verified source additions

### USGS 3DEP
The National Map is the primary USGS delivery system for elevation data. LidarExplorer supports 3DEP lidar and derived DEM discovery/download/visualization, and The National Map exposes downloads, web services and an Access API. TSM preserves product metadata, quality level, acquisition/project identity and spatial metadata.

### FEMA NFHL
FEMA's NFHL is the digital flood-hazard layer containing FIRM databases and applicable map changes. TSM keeps effective status, study date, LOMR lineage and source identifiers attached to flood-hazard evidence. NFHL is a regulatory-context layer, not a site-specific engineering certification.

### Indiana INFIP
Indiana DNR's Floodplain Information Portal exposes FEMA/DNR floodplain information, BFE information and FARA generation. The evidence chain should retain FARA artifacts for applicable Indiana A-zone workflows.

### USACE levees and water data
The National Levee Database provides national levee-system information. USACE Water Data provides a separate federal water-data context plane. Neither replaces the USGS/NOAA live-observation hierarchy already used by TSM.

### USACE beneficial use and Section 204
USACE documents beneficial uses of dredged material including habitat development, wetland creation, brownfield reconstruction and other productive uses. Section 204 of WRDA 1992, as amended, provides an authority pathway for eligible partnership projects associated with dredging for an existing authorized federal navigation project. It is not an automatic project approval, funding guarantee or material-availability guarantee.

USACE project examples demonstrate protective berm/dune placement with dredged material. TSM therefore models source material qualification, environmental testing, geotechnical characterization, transport/logistics, ownership/access, hydraulic effects, and agency review as separate gates.

### USDA agricultural fabric
SSURGO provides soil map units and attributes including flooding, water capacity, conductivity, crop productivity and engineering limitations. Soil Data Access supports real-time/ad-hoc spatial and tabular requests. gSSURGO provides gridded soil products. USDA NASS Cropland Data Layer provides annual crop/land-cover context. Together these support agricultural drainage, inundation, soil-loss, access-road and restoration scenarios.

## Engineering integration
The new schemas and screening module support candidate berm/road alignments, dredged-material routing, preliminary prism-volume quantities, baseline-versus-alternative HEC-RAS references, no-rise/floodway/wetland gates, property-rights and utility checks, and explicit human/agency acceptance gates.

The placement calculator is a screening tool only. It does not certify slope stability, settlement, bearing capacity, pavement design, scour, erosion, freeboard, no-rise compliance, wetland jurisdiction, or regulatory eligibility.

## Recommended operational layers
- USGS 3DEP bare-earth DEM and lidar point clouds
- USGS NHDPlus HR and WBD
- FEMA NFHL, FIRM panels, FIS and LOMC products
- Indiana INFIP/BAFM
- USACE National Levee Database
- USACE water/navigation context
- USDA SSURGO, gSSURGO and Soil Data Access
- USDA NASS Cropland Data Layer
- IL/IN/KY state parcel, road, elevation and imagery services
- HEC-RAS geometry, terrain, boundary conditions and real output artifacts
- bathymetry/topobathy where available
- precipitation and forecast products

## Source URLs
- https://www.usgs.gov/the-national-map-data-delivery
- https://www.usgs.gov/tools/lidarexplorer
- https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
- https://msc.fema.gov/portal/search
- https://levees.sec.usace.army.mil/
- https://water.usace.army.mil/map
- https://www.usace.army.mil/Missions/Civil-Works/Beneficial-Use-Program/
- https://www.nwd.usace.army.mil/missions/civil-works/project-plans/partnership-agreements/
- https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/
- https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo
- https://sdmdataaccess.nrcs.usda.gov/
- https://www.nrcs.usda.gov/resources/data-and-reports/gridded-soil-survey-geographic-gssurgo-database
- https://nassgeodata.gmu.edu/CropScape/
