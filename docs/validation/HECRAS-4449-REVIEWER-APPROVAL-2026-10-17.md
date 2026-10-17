# HEC-RAS Model 4449 — Preliminary Archive QA (NOT an Execution Approval)

**Review date:** 2026-10-17  
**Model:** Indiana DNR HydroModel ID 4449 — Ohio River, J. T. Myers Pool  
**Current disposition:** `CANDIDATE_ARCHIVE_ONLY`  
**Execution authorization:** `NOT_GRANTED`  
**Qualified human review:** `NOT_RECORDED`

## Correction to the prior version of this note

The prior AI-authored note used the heading “APPROVAL FOR EXECUTION” and stated “APPROVED for technical execution.” That wording is withdrawn. An AI-generated review is not a qualified human hydraulic-engineering review, and the evidence recorded below does not establish the spatial reference system, vertical datum, model extent, current boundary conditions, solver compatibility, or suitability for the candidate property.

**Do not treat this document or the prior version as authorization to run this model for site-specific design, flood-depth, permitting, or regulatory conclusions.** The property AOI remains unapproved.

## What the automated evidence establishes

The [TSM CI pipeline run for revision `e7fbe370`](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39080234967) produced a [hydraulic-model validation artifact](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39080234967/artifacts/12117789332).

For `model-4449-JTMyers-FIS.zip`, that report establishes:

| Check | Observed result | Meaning |
|---|---|---|
| ZIP CRC/integrity | PASS | The ZIP members passed the archive integrity check. |
| Full SHA-256 | `938dd9e593f6554b1b7d7095ff11eecc4862bf6c8a6966e88fd6db7f7ff5a7f6` | Identifies the exact committed archive bytes. |
| Project/geometry structure | `jtmyers.prj` and `jtmyers.g01` present | Basic file presence only; the solver was not launched. |
| Horizontal CRS evidence in bounded text scan | Not found | CRS and georeferencing remain unverified. |
| Vertical-datum evidence in bounded text scan | Not found | The prior NGVD29 claim remains unverified by this automated report. |
| Spatial compatibility with site AOI | NOT VERIFIED | No common-CRS extent/overlay result is available. |
| Engineering approval | NOT GRANTED | Archive QA does not authorize execution. |

The validator performs archive integrity, member-path safety, full-hash, basic structure, and bounded text-metadata checks. It does **not** validate hydraulic calculations, open the model in HEC-RAS, establish reach coverage, verify boundary conditions, or certify model results. “Evidence not found in a bounded text scan” is not proof that a metadata value is absent from every possible source; it is a reason to obtain and verify that value before proceeding.

## Assertions from the prior note that are not accepted as verified here

The prior version asserted 47 cross-sections, a Manning's (n) range, HEC-RAS 3.1.3 compatibility, NGVD29 as the vertical datum, a river-mile extent of 846–773, a datum offset of approximately 0.7 ft, and plausibility of a 375.0 ft BFE. The current archive-validation report does not independently establish all these facts. In particular:

- The automated scan found no explicit horizontal CRS or vertical-datum evidence for archive 4449.
- No format-aware GIS operation has established the archive's spatial extent or overlap with the site's parcel, structure, or receiving catchment.
- No documented vertical transformation has been calculated and verified for the relevant source datum, target datum, and location.
- The archive's stored output files have not been compared with a fresh, qualified HEC-RAS execution in a compatible software environment.

These are unresolved review items, not validated facts.

## Datum and model lineage cautions

### DNR HEC-RAS archive

DNR catalog metadata identifies model 4449 as the Ohio River J. T. Myers Pool Flood Insurance Study model, HEC-RAS 3.1.3, with an effective-study date of November 5, 2014. That lineage is useful discovery context; it does not itself demonstrate that the historic model answers a current site-specific question.

### ERDC/CHL TR-22-4 is a separate model

The repository also contains `data/fabrics/reports/ERDC-CHL-TR-22-4.pdf`, *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation* (USACE ERDC/CHL, February 2022). Its description identifies a **2D Adaptive Hydraulics (AdH)** study—not the DNR HEC-RAS 4449 project.

The report describes the horizontal coordinate system as **UTM Zone 15 North, NAD83, meters**, and the vertical datum as **“Ohio River” Datum**. At J. T. Myers Locks and Dam, it states that this value is NGVD29 minus 0.35 ft (report p. 9). It describes a confluence-focused study domain that extends downstream to Smithland Locks and Dam (report pp. 3 and 14) and uses Wabash and Ohio River inflow boundary conditions (report pp. 9 and 33). These are model-specific study facts, not an automatic conversion recipe for the DNR HEC-RAS archive or a property-level BFE.

### Official datum and coordinate-system guidance

- [NOAA National Geodetic Survey — VERTCON 3.0](https://www.ngs.noaa.gov/VERTCON3/index.shtml): the transformation grids relate NGVD 29 and NAVD 88; NGS identifies NCAT as the coordinate transformation tool incorporating VERTCON 3.0. The transformation must be selected and documented for the relevant location and datum pair. Do not apply an unverified constant offset.
- [HEC-RAS User's Manual — Vertical Datum Adjustment](https://www.hec.usace.army.mil/confluence/rasdocs/rasum/7.0/entering-and-editing-geometric-data/geometric-data-tools/vertical-datum-adjustment): HEC-RAS supports elevation adjustments to model data, including single-value and location/table-based approaches. That capability is not a substitute for proving the source and target datums and choosing the correct transformation.
- [HEC-RAS Geometry Tools — Re-projecting Model Geometry](https://www.hec.usace.army.mil/confluence/rasdocs/hgt/latest/guides/re-projecting-model-geometry): HEC documents coordinate-system conversion and warns that HEC-RAS does not support coordinate transformations requiring a horizontal datum shift; converted geometry and terrain must be checked in the destination coordinate system.
- [Indiana DNR — Hydrology & Hydraulics](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links/): links the historical Model Library, its HEC-RAS Geometric Data Tool, and state hydraulic assessment guidance.

## Required gates before any site-specific execution

- [ ] Reconcile the archive's horizontal CRS, projection zone, coordinate units, and georeferencing from the project, geometry, projection files, and DNR source metadata.
- [ ] Verify all model geometry coordinates and extent with a format-aware HEC-RAS/GIS tool; compare against authoritative DNR reach geometry in a common CRS.
- [ ] Establish source vertical datum and units directly from model metadata/source documentation; document the approved transformation to the target terrain/result datum.
- [ ] Review project/plan/geometry/flow file references and model-version compatibility; confirm whether archived output files correspond to the intended plan.
- [ ] Review inflow/outflow boundary conditions, calibration/validation evidence, terrain/bathymetry, structures, roughness, and the intended question.
- [ ] Check the applicable effective FEMA FIS/FIRM and Indiana DNR floodplain data; do not infer a site BFE from a regional model label or no-data sentinel.
- [ ] Complete a separate, reproducible site-AOI and catchment/outlet review. Parcel, structure, watershed, and hydraulic model domain remain distinct geometries.
- [ ] Obtain dated approval from a qualified human hydraulic reviewer appropriate to the intended use. Regulatory/design use requires professional engineering oversight as applicable.

**Disposition remains BLOCKED.** No HEC-RAS run, flood-depth claim, design conclusion, or regulatory approval is authorized by the archive-integrity pass or this AI-generated note.
