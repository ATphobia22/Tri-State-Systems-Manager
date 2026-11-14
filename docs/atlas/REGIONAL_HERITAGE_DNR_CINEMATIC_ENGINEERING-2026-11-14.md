# Tri-State Atlas: historical, DNR and cinematic engineering integration
Date: 2026-11-14  
Scope: public `/atlas/` and its MapLibre viewer. Mount Vernon, Indiana is the navigation anchor; the regional map extends into Illinois and Kentucky.

## Implemented, source-backed browser layers

| Layer | Authoritative endpoint | Attribute / provenance | Map state |
| --- | --- | --- | --- |
| National Register public historic points | NPS `https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0` | `RESNAME,NRIS_Refnum,ResType,County,State`; NPS excludes restricted/sensitive site locations | Tappable markers with site-detail panel; enabled on public regional view |
| Indiana DNR state parks | Indiana DNR `https://gisdata.in.gov/server/rest/services/Hosted/Sites_StateParks/FeatureServer/8` | `site,category,activities,website` | Tappable park markers; enabled |
| Indiana DNR nature preserves | Indiana DNR `https://gisdata.in.gov/server/rest/services/Hosted/DNRGIS_DnrNPSites_DNR_IN_1/FeatureServer/18` | `npname,county,description,ownership,externalurl,link` | Tappable markers; opt-in |

**Count probes, November 14, 2026:** NPS 436, state parks 2, nature preserves 12 for WGS84 envelope `-89.6,36.9,-86.8,38.8`, using official ArcGIS `returnCountOnly=true` queries. These are *not* county-level complete inventories; the geographic envelope includes extra areas and services can omit sites. API queries are on demand and return GeoJSON. Per-request result limit: 1,000; count probes are below that threshold, but source changes require recounting. No private location or restricted archaeology coordinates are generated.

### Visual/UI behaviors
- Icon/color distinguishes public National Register records, parks, preserves; tapping reveals source-backed facts and official links.
- Popups are React text (escaped), URLs use HTTPS validation. Public map remains anonymous.
- Accessibility: 44px-close/touch targets, visible heading, text contrast and reduced-motion options. Full screen-reader / keyboard feature-picking certification **not yet demonstrated**.
- Cinematic only: selectable river mist, rain overlay, vintage film treatment. Effects have no hydraulic/meteorological authority and never change spatial source records or USGS observations.
- Historic listing **does not imply public entry**, survey accuracy, safe digging, construction permission, or historic-property clearance. Check owner and preservation office.

### Source QA and integration limits
- Indiana DNR sites cover Indiana only. Obtain separate official Illinois DNR and Kentucky tourism/parks/preservation inventories with compatible schema and explicit licensing before claiming equivalent coverage.
- WGS84 point coordinates are locator points, not legal site boundaries or survey control; critical infrastructure work needs cultural-resources consultation, Section 106 applicability assessment, and on-site surveys if required.
- A future headless pipeline should record layer ID, retrieved timestamp, source release date, county join, geometry validity, coordinate reference system, sensitive-site policy, license and SHA-256 for every materialized snapshot.
- Avoid persisting source-internal state or claiming this source data constitutes an approved engineering design.

## Forked repository reconnaissance — staged recommendations

The GitHub fork search inventoried 1,000 publicly discoverable fork results. This is a **bounded survey, not a verified exhaustive audit**. The following READMEs were inspected from actual `ATphobia22` forks.

| Fork | Innovative use | Gate |
| --- | --- | --- |
| `ATphobia22/ras-commander` | Headless HEC-RAS project orchestration and read-only result extraction, producing HDF provenance for map visual layers | Reconcile exact RAS versions, run real calibration/cross-section and model evidence; no synthetic stage as real |
| `ATphobia22/pyswmm` | Sanitary/storm sewer and drainage scenario results linked to user-proposed utility corridors | Independent verified network, catchments, rainfall, EPA SWMM version and units first |
| `ATphobia22/3DTilesRendererJS` | Hierarchical 3D Tiles streaming and tile selection in browser 3D scene | Test against current Three.js/MapLibre adapter, license, LOD, memory, geometry |
| `ATphobia22/3d-tiles-tools` | Headless 3D Tiles transform, validator and optimize evidence for Posey buildings | Immutable input SHA, complete footprint provenance and license review |
| `ATphobia22/HoudiniEngineForUnreal` | Procedural roads, utilities and city-scale structures for UE5.8 editor | README claims UE5.8 support; verify plugin binary/Houdini version, editor only |
| `ATphobia22/HoudiniUsdBridge` | Exchange procedural USD scenes in a pinned production pipeline | Never use default master; pin Houdini branch and exact release tag as upstream README instructs |
| `ATphobia22/WebGL-Fluid-Simulation` | Movie-look surface flow and low-cost visual ripple effects, segregated from engineering water surfaces | MIT reference; never classify GPU effects as HEC-RAS hydrodynamics |
| `ATphobia22/OpenFOAM-dev` | Controlled high-fidelity local CFD case study where calibrated boundaries exist | Heavy computation offline/headless; benchmark and mesh provenance |
| `ATphobia22/HoudiniEngineForUnreal-v2` | Legacy alternate plugin code | Avoid mixing with version 3 unless exact compatibility established |

### Engineering and cinematic innovation roadmap
1. **Headless solver interface:** versioned scenario manifest, CRS/datum/units, hydrology input archive, reproducible model execution, checksums and scenario output registry. Choose EPA SWMM (utility drainage) and USACE HEC-RAS (river hydraulics) appropriately. Leave models *not evidenced* until calibrated data are supplied.
2. **Interactive flood comparison:** use HEC-RAS output rasters + water-surface time slices, joined to audited terrain. Use the existing deck.gl depth-class/contour visualizer, but never plot synthetic demo depths as Mount Vernon conditions.
3. **Utility-aware historic review:** proposed sewer/water/power/fiber alignments should flag possible proximity to public historic register points or protected lands, without implying protected-boundary intersection from a point geometry.
4. **Virtual-production pipeline:** UE5.8 World Partition scene, lighting and atmospherics, Niagara for non-physical rain/mist, Movie Render Queue/Graph for shots, optional USD/Houdini-generated assets. Render headed; extraction, terrain/HLOD baking and validation headless.
5. **Public UX:** expose named place search, provenance drawer and accessible site listing; add children/elder-friendly plain language plus specialist detail modes. Test narrow/mobile, tablet, desktop, low-power and prefers-reduced-motion.
6. **Evidence boundaries:** human authority final; no unverified elevations, parcel-level decisions, DNR access promises, forecast water levels or regulatory certification.

## Official technical references
- NPS NRHP data downloads: https://www.nps.gov/subjects/nationalregister/data-downloads.htm
- Indiana DNR locations: https://www.in.gov/dnr/places-to-go/indiana-dnr-locations/
- EPA SWMM: https://www.epa.gov/water-research/storm-water-management-model-swmm
- USACE HEC-RAS mapping: https://www.hec.usace.army.mil/confluence/rasdocs/rmum/6.2/mapping-results/creating-results-maps
- USACE HEC-RAS 2D: https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/latest/introduction/developing-a-2d-or-1d-2d-unsteady-flow-model
