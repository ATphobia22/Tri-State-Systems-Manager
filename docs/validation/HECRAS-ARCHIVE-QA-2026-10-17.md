# HEC-RAS Archive QA — 2026-10-17

**Validated repository revision:** `e7fbe370e01d489b22c19fae0df2597b8aa733c5`  
**Workflow:** [TSM CI Pipeline run 39080234967](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39080234967)  
**Machine-readable report:** [hydraulic-model-validation artifact](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39080234967/artifacts/12117789332)  
**Overall archive gate:** PASS — 8 archives checked, 8 ZIP integrity checks passed, 0 failed.

## Scope

The committed validator, `scripts/hydrology/validate_model_archives.py`, checks ZIP integrity/CRC, full SHA-256, member-path safety, duplicate members, basic HEC-RAS project/geometry/flow-plan/output file presence, and a bounded scan for literal CRS/datum clues. It does not launch HEC-RAS, verify computed results, determine effective regulatory status, calculate exact model extents, or compute overlap with the candidate AOI.

“Not found” below means the bounded text scan did not find the literal evidence. It is not proof that every possible external metadata source lacks the value. All eight archives remain `spatial_compatibility=NOT_VERIFIED` and `engineering_approval=NOT_GRANTED` in the machine-readable report.

## Integrity results

| DNR model ID | Archive | Size (bytes) | Full SHA-256 | ZIP CRC | CRS/datum metadata found by scan |
|---:|---|---:|---|---|---|
| 1738 | `model-1738.zip` | 3,649 | `b45487fc49c5ab62f32b3332a8037c7d9eb49c267522016b130db4bf9117ca9c` | PASS | No explicit horizontal CRS or vertical datum evidence found |
| 6149 | `model-6149.zip` | 2,208,510 | `2493f4c3450deaf1f6cc935a39dabff66d414e161b49b5a3cfd452e400958fbc` | PASS | State Plane; projection-zone field `2966`; datum `NAD83`; vertical-datum value blank |
| 653 | `model-653.zip` | 6,184 | `68ed2f4ad2d621e4c2045c85c61dde4b1a16441b572427dc741c19ee2b6c870a` | PASS | No explicit horizontal CRS or vertical datum evidence found |
| 9917 | `model-9917-Final_Model.zip` | 54,752 | `5bbc900416edc4ed6844235ea0c878f285d30e41977e8b1d0225129e28f2b4b2` | PASS | No explicit horizontal CRS or vertical datum evidence found |
| 9928 | `model-9928-MR-35369.zip` | 9,189 | `4b8ca4f6d6a5c31b0b84bc57ceba96cb86a5fa43bede95490e03e7ab039858b3` | PASS | No explicit horizontal CRS or vertical datum evidence found |
| 3551 | `model-3551-ABENGOA.zip` | 979,882 | `4d29e9d9f0162c9f38141c257c075dd8d53e34c044a213bfa61f15425ae0d8aa` | PASS | State Plane and NAD83; projection-zone field blank. Project text says NAVD 1988; GIS vertical-datum field blank |
| 4449 | `model-4449-JTMyers-FIS.zip` | 211,338 | `938dd9e593f6554b1b7d7095ff11eecc4862bf6c8a6966e88fd6db7f7ff5a7f6` | PASS | No explicit horizontal CRS or vertical datum evidence found |
| 8778 | `model-8778-UNTOhioRiver.zip` | 236,064 | `56c60975f0511d6b9f306193c57e7b0b3690139e22c07c0b08c0957e2407b400` | PASS | State Plane; projection-zone field `2966`; datum `NAD83`; vertical-datum value blank |

All eight archives contain at least one `.prj` project file and at least one geometry file according to this structural scan. This is not equivalent to verifying that the project references a consistent active plan, geometry, flow file, or solver-ready model.

## Interpretation and remaining engineering checks

1. **Archive integrity is closed.** ZIP CRC checks and complete SHA-256 hashes are recorded above and in the CI artifact.
2. **Horizontal spatial compatibility remains open.** Several archives have no explicit CRS evidence in the scanned text; two have a State Plane zone field present as 2966 and NAD83 but no vertical datum value. The State Plane label alone is not sufficient to overlay those models against the property, terrain, or flood layers.
3. **Vertical compatibility remains open.** Model 3551's project text states NAVD 1988 while its GIS vertical-datum field is blank; model 6149 and 8778 have blank GIS vertical-datum fields. Model 4449's prior AI-generated NGVD29 assertion was not found in this archive scan and is not accepted as verified.
4. **Spatial overlap is not established.** A format-aware parser must extract and validate georeferenced cross-section/geometry coordinates and their correct coordinate system before transforming them and comparing their extents to the candidate AOI.
5. **Boundary conditions and solver behavior are not validated.** Review the active plan, flow/plan files, upstream/downstream conditions, calibration/validation records, terrain/bathymetry, and historic effective study status with a qualified human hydraulic reviewer before an execution decision.

## Source notes

- The Indiana DNR [Hydrology & Hydraulics page](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/hydrology-and-hydraulics-links/) describes the Model Library as a source for prior Flood Insurance Study, floodway-permit, FARA, and other hydrologic/hydraulic models. Its geometric-data tool uses Indiana LiDAR and the National Hydrography Dataset to create HEC-RAS geometric input.
- NOAA NGS [VERTCON 3.0](https://www.ngs.noaa.gov/VERTCON3/index.shtml) describes NGVD 29/NAVD 88 transformation grids and the NCAT workflow. Do not substitute a blanket elevation offset for a documented, location-appropriate transformation.
- HEC-RAS documentation: [Vertical Datum Adjustment](https://www.hec.usace.army.mil/confluence/rasdocs/rasum/7.0/entering-and-editing-geometric-data/geometric-data-tools/vertical-datum-adjustment) and [Re-projecting Model Geometry](https://www.hec.usace.army.mil/confluence/rasdocs/hgt/latest/guides/re-projecting-model-geometry). Geometry, coordinate system, and terrain association must be checked after projection changes.
- The repository's [ERDC/CHL TR-22-4 report](../../data/fabrics/reports/ERDC-CHL-TR-22-4.pdf) describes a separate 2D AdH confluence study. Its report page 9 specifies UTM Zone 15 North, NAD83, meters and an “Ohio River” vertical datum; at J. T. Myers Locks and Dam it states this corresponds to NGVD29 minus 0.35 ft. This does not establish the datum or suitability of any DNR HEC-RAS archive.

## Release decision

**All eight ZIPs pass archive integrity; none is approved as a site-specific model input.** The candidate AOI remains unapproved, and no site-specific HEC-HMS/HEC-RAS execution or flood-depth/design conclusion is authorized by this QA report.
