# Ohio–Wabash bathymetry and certifiable model evidence

**2026-11-22 | Engineering source research and preflight | NOT CERTIFIED**

## Acquiring genuine bathymetry

1. USACE eHydro source surveys, XYZ soundings, TIN/FGDB and XML metadata: https://experience.arcgis.com/experience/5d0c66327d1049a3937b269002fb7c77/page/Home . First identify an actual Ohio or Wabash river reach intersecting the project AOI. Survey footprints are discovery polygons, not bottom elevations. Retain survey job ID, survey/acquisition date, version, acquisition method, control and all source files.
2. USGS inland topobathymetry and footprint inventory: https://www.usgs.gov/3d-elevation-program/inland-bathymetry . Verify geographic and lidar/soundings coverage explicitly; national datasets do not imply surveyed coverage at this confluence.
3. NOAA NCEI: https://www.ncei.noaa.gov/maps/bathymetry/ and USIEI https://www.coast.noaa.gov/inventory/ for survey discovery. NOAA archives primarily focus on maritime/coastal coverage and must not be represented as verified inland riverbed coverage without a matching source record.

The local atlas presently contains eHydro survey **extents**, not validated bathymetric depth/elevation rasters. Do not create a synthetic bed from contours or river polygon footprints and label it authoritative.

## Local preflight code

New Python module: services/living-twin/twin/bathymetry_intake.py.
Run from services/living-twin:

    python -m twin.bathymetry_intake survey-manifest.json --survey-root path/to/survey --aoi-bbox -88.1 37.6 -87.7 38.0

This verifies actual local survey byte hash, declared provenance, date ordering, EPSG with matching horizontal axis units, source footprint/AOI overlap, z-value semantics and surveyed vertical uncertainty. If vertical datum is Ohio River Datum or NGVD29, it requires separately reviewed NAVD88 conversion evidence. If z is a depth, a depth-to-elevation conversion remains unresolved. Quality control and independent survey-control reviews are separately required. A metadata-only pass cannot authenticate the producer or confer an engineering seal; no riverbed raster is generated.

## Source/model distinctions

- The Ohio River Community HEC-RAS Model paper by Thomas Adams et al., found in Google Drive as TheOhioRiverCommunityHEC-RASmodel.pdf, describes the historical shared NWS/USACE **1D** unsteady mainstem model. It discusses Ohio River Datum to NGVD29 to NAVD88 processing, along with channel cross-sections, bathymetry and calibrated stages. Its historic calibration statistics are not current model validation for Posey County.
- The ERDC/CHL TR-22-4 Wabash–Ohio confluence study uses **2D AdH and SEDLIB** navigation/sediment modeling with sonar and ADCP inputs. It is not the same as a current HEC-RAS 2D flood-mapping model. Repository research note: docs/research/ERDC-CHL-TR-22-4-Wabash-Ohio-Evidence-Note.md.
- The Indiana DNR HEC-RAS ZIP inventory in docs/validation/HECRAS-ARCHIVE-QA-2026-10-17.md passed CRC/checksum inspection, but its models still have unresolved spatial/datum and scientific execution gates. Model 4449 does not have an independently verified vertical datum in the local scan; 8778 has a blank GIS vertical datum; 3551 has project-level NAVD88 text with a separate blank GIS field. No such archive can be silently promoted as a solver-validated result.

## Unit- and datum-safe calculations

Observed water surface, when a reviewed station zero is applicable:

    H_observed_NAVD88(t) = h_gage(t) + Z_gage_zero_NAVD88

For a positive depth below the water surface, after correcting survey depth:

    Z_bed_source = H_water_source(t_survey) - d_corrected

Then use a verified, position-appropriate, epoch-aware geodetic transformation to NAVD88; do not assume a uniform Ohio River Datum adjustment across miles, or transfer another station's gage zero.

For paired independent observations:

    residual_i = H_model_i - H_observed_i
    bias = sum(residual_i) / n
    MAE = sum(abs(residual_i)) / n
    RMSE = sqrt(sum(residual_i**2) / n)
    NSE = 1 - sum(residual_i**2) / sum((H_observed_i - mean(H_observed))**2)

NSE is undefined with zero observed variance. Report number of pairs, sampling and space-time support, quality code, station/plan/datum IDs and uncertainty on each result. Calibration and independent holdout observation events cannot overlap.

For independent standard uncertainties only:

    sigma_combined**2 = sigma_observation**2 + sigma_datum**2
                        + sigma_bathymetry**2 + sigma_model**2

If errors are correlated, add cross-covariance terms. Convert quoted 95% uncertainty to standard uncertainty using its documented coverage factor. USGS's 0.16-ft two-sigma geodetic vertical datum criterion is not an allowable total hydraulic residual.

For 2D model control volumes:

    dV/dt = sum(Q_in) - sum(Q_out) + Q_lateral

Retain solver messages, volume imbalance and time series, mesh/grid, timestep and convergence diagnostics. A successful process exit or low RMSE alone does not prove conservation or acceptability.

## Matrix and governor contract

| Matrix | Meaning | Prohibited shortcut |
| --- | --- | --- |
| O | USGS observation with original timestamp, series, unit, gage datum, quality and hash | Do not silently call raw parameter 00065 a NAVD88 elevation |
| E | Surveyed bathymetry, terrain, parcel geometry and accurate spatial reference | Do not treat eHydro extent polygons as bed soundings |
| H | Revision-pinned hydraulic run with full flow, boundary conditions, terrain, roughness, logs and HDF5 | Do not call historical 1D DNR archives a current 2D solved model |
| V | Independent holdout comparisons, datum tie, uncertainty and sensitivity audit | Do not reuse fitted observations in holdout |
| R | Human engineering review, publication evidence, jurisdiction and agency authority | Software code cannot create a legal PE seal or FEMA approval |

Adaptive tuning is restricted to a new H-model revision with explicit parameter changes and replay evidence. Observed O data are immutable. No fitted or adaptive engine may learn on withheld V events and claim those same events as independent validation. Public Atlas and offline UE display do not bypass the headless release governor.

## Professional review and regulatory boundary

- USACE HEC-RAS reference documents and verification/validation: https://www.hec.usace.army.mil/confluence/rasdocs/hgt/latest/reference-documents
- USACE HEC-RAS 2D volume accounting: https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/7.0/running-a-model-with-2d-flow-areas/computation-progress-numerical-stability-and-volume-accounting
- FEMA numerical model acceptance: https://www.fema.gov/sites/default/files/documents/fema_rm-accepting-numerical-models-guidance-nov-2023.pdf
- Indiana licensing and seal: https://www.in.gov/pla/professions/engineering-home/engineering-licensing-information/ and https://www.law.cornell.edu/regulations/indiana/864-IAC-1.1-7-4

A qualified, appropriately licensed engineer must actually review the applicable results, methods, sources and assumptions and take professional responsibility where required. FEMA numerical-model acceptance and map determinations require their own administrative/regulatory process. Indiana licensure is not interchangeable with Kentucky or Illinois licensure.

## Open physical release gates

Obtain original eHydro survey/metadata files for the exact confluence reach; verify survey dates/coverage and original XYZ geometry; secure a reviewed surveyed Ohio River Datum/NGVD29/NAVD88 transformation; resolve actual station benchmark data; reproduce an actual HEC-RAS run with pinned version, artifacts and mass-balance diagnostics; validate against independent observations and review uncertainties; obtain qualified independent engineering and agency review as required. Until then, release state remains **SOURCE_EVIDENCE_INCOMPLETE** and all stage-derived WSE/flood-depth certification remains withheld.
