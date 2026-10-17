# Indiana DNR Hydrology & Hydraulics Model Library — Posey County Inventory

**Research date:** 2026-10-17  
**Status:** Catalog queried; candidate records identified; model ZIP payloads not yet acquired or validated.  
**Use:** Discovery/evidence only. This inventory is not an approved model input and does not authorize a HEC-RAS run.

## Official entry points

- Indiana DNR Hydrology & Hydraulics: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links/
- Indiana DNR Model Library viewer: https://experience.arcgis.com/experience/0ce352ac91004fabae9672c9d53527d9/
- Short link cited by Indiana DNR quick guide: https://on.in.gov/hydro-library
- Indiana DNR HEC-RAS Geometric Data Tool: https://indnr.maps.arcgis.com/apps/webappviewer/index.html?id=b46f3c84a927457a8189b5509725550e
- HydroModelLibrary metadata table: https://gisdata.in.gov/server/rest/services/Hosted/HydroModelLibrary/FeatureServer/2
- HydroModel table service: https://gisdata.in.gov/server/rest/services/Hosted/HydroModel/FeatureServer/8
- HydroModel file-link table: https://gisdata.in.gov/server/rest/services/Hosted/HydroModel/FeatureServer/22

DNR describes the Model Library as a viewer for previously developed models for Flood Insurance Studies (FIS), Construction in a Floodway permit applications, Floodplain Analysis / Regulatory Assessment (FARA), and other purposes. The HEC-RAS Geometry Tool uses Indiana LiDAR and the National Hydrography Dataset to create HEC-RAS geometric input. These are official DNR descriptions; see the links above.

## Verified Posey County records surfaced by the public catalog

The catalog query used the official ArcGIS REST table, filtering `scountyname='Posey'` and then narrowing by waterbody or basin. IDs below are `hydromodelid` values in DNR metadata, not guaranteed download URLs.

| Priority | HydroModel ID | Waterbody / reach | Catalog classification | Software / source | Catalog note |
|---|---:|---|---|---|---|
| High | 4449 | Ohio River; reach 181290100133 | FIS | HEC-RAS 3.1.3; USACE | “JT Myers Pool. FIS effective November 5, 2014.” |
| High | 8778 | Unnamed tributary to Ohio River; reach 181290100129 | APPROX_ZoneA | HEC-RAS 4.1.0; Indiana DNR | Approximate model from OCRA Zone A |
| Medium | 3551 | Unnamed tributary to Ohio River; reaches 181290100133 and 181290100134 | PERMIT / FW | HEC-RAS 3.1.3; Morley and Associates, Inc. | Proposed ethanol plant / rail loop and service road in floodway |
| Medium | 3776 | Ohio River; reaches 181290100121 and 181290100133 | PERMIT / FW | HEC-RAS 4.0; SITran LLC | Rail-to-barge coal transfer facility on north bank |
| Medium | 2517 | Ohio River; reach 181290100133 | FIS (superseded) | Corps of Engineers water-surface profile | Legacy `ohio_uniontown.dat`; explicitly superseded by FIS dated November 5, 2014 |
| Medium | 1739 | Ohio River; reach 181290100133 | PERMIT / FW | Corps of Engineers water-surface profile | Legacy filename `fw18842.zip`; soybean processing plant; metadata date is old |
| Medium | 8755 | Olive Creek; reach 181290100067 | APPROX_ZoneA | HEC-RAS 4.1.0; Indiana DNR | Approximate model from OCRA Zone A |
| Medium | 8671 | Big Bayou; reach 181290100037 | APPROX_ZoneA | HEC-RAS 4.1.0; Indiana DNR | Approximate model from OCRA Zone A |
| Medium | 8771 | Harmony Creek; reaches 181290100055 and 181290100094 | APPROX_ZoneA | HEC-RAS 4.1.0; Indiana DNR | Approximate model from OCRA Zone A |
| Medium | 9914 | Harmony Creek; reach 181290100055 | PERMIT | HEC-RAS 5.0.3; Banning Engineering | Bank stabilization / ditch work description |
| Medium | 9916 | Little Creek; reach 181290100005 | PERMIT | HEC-RAS 4.1.0; VS Engineering, Inc. | Caborn Road bridge replacement |

The Ohio River and unnamed-tributary records are the strongest initial candidates for confluence-area research, but reach identity and spatial overlap must be verified against actual model geometry before selecting any archive. Records tagged `APPROX_ZoneA` are approximate and must not be represented as detailed effective models. Permit models are project-specific and may describe proposed conditions rather than the current river system. The 2014 FIS model is more relevant as a documented effective-model candidate than the explicitly superseded legacy profile, but its actual contents still need inspection.

## Download investigation and blocker

The public catalog exposes metadata and a related file-link table. For HydroModel ID `4449`, the related row identifies the archive as:

```
\\DNRFILP02PW\DNRWATER\UnityPictures\HydroModel\4449\4449.zip
```

That is a Windows UNC path, not a public HTTPS download URL. The ArcGIS REST metadata endpoint is public, but the file-link row does **not** itself expose the ZIP bytes or a usable public download URL. The viewer renders a dynamic “Click here to download model” action, but a text scrape of the viewer did not resolve the action to a working archive URL. Consequently, no model archive has been downloaded, hashed, opened, or validated in this commit.

**Next acquisition step:** use the official viewer at https://on.in.gov/hydro-library, select the Ohio River / target stream segment, and invoke the model download action. If the action fails or the download requires an internal DNR path, request a public archive link from Indiana DNR Division of Water at water_inquiry@dnr.IN.gov. Do not guess a URL from the UNC path. Repeat for IDs 8778 and the other shortlisted records only after confirming the target reach.

## Required acceptance gates for every acquired archive

1. Save the untouched ZIP under an external/raw-data store (not Git history) and record retrieval timestamp, source URL or official viewer action, HydroModel ID, catalog record JSON, archive size, and SHA-256.
2. Check ZIP integrity and inventory all files before extraction; preserve the original archive.
3. Identify the model type, software version, effective/proposed status, study purpose, stream reach, model owner, and revision date from the actual archive and report.
4. Inspect HEC-RAS project/geometry/flow/plan files using supported software tooling. Never infer compatibility from the catalog's program string alone.
5. Verify horizontal CRS, units, vertical datum, cross-section and structure coverage, downstream/upstream boundary conditions, flow profiles, and any calibration/validation evidence.
6. Spatially compare model geometry to the intended reach/AOI and determine whether its boundary conditions connect to the Ohio–Wabash confluence.
7. Keep model execution blocked until a qualified reviewer approves provenance, suitability, geometry, boundary conditions, and the relevant AOI.

## Source references

- DNR model library overview and geometry-tool description: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links/
- Official catalog metadata query for Posey County: https://gisdata.in.gov/server/rest/services/Hosted/HydroModelLibrary/FeatureServer/2/query?where=scountyname%3D%27Posey%27&outFields=*&returnGeometry=false&f=pjson
- Ohio River records query: https://gisdata.in.gov/server/rest/services/Hosted/HydroModelLibrary/FeatureServer/2/query?where=scountyname%3D%27Posey%27%20AND%20swaterbodyname%20LIKE%20%27%25Ohio%20River%25%27&outFields=*&returnGeometry=false&f=pjson
- Lower Wabash basin records query: https://gisdata.in.gov/server/rest/services/Hosted/HydroModelLibrary/FeatureServer/2/query?where=scountyname%3D%27Posey%27%20AND%20strbasinname%3D%2716%20Lower%20Wabash%20River%27&outFields=*&returnGeometry=false&f=pjson
- Indiana General Guidelines for the Hydrologic-Hydraulic Assessment: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/general-guidelines-for-the-hydrologic-hydraulic-assessment/
