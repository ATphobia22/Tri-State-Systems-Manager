# HEC-RAS Model Validation — 2026-10-17

## Model 4449: JT Myers Pool (Ohio River FIS)

**File:** `model-4449-JTMyers-FIS.zip`  
**SHA-256:** `938dd9e593f6554b1b7d7095ff11eecc4862bf6c8a6966e88fd6db7f7ff5a7f6`

| Gate | Status | Finding |
|---|---|---|
| Archive integrity | PASS | ZIP CRC validation passed; full SHA-256 recorded |
| Model structure | PASS | HEC-RAS project, geometry, flow/plan and output files present |
| Software version | PASS | HEC-RAS 3.1.3, matching catalog metadata |
| Units | Reported | English units (feet) |
| Vertical datum | CAUTION | **NGVD 1929 (NGVD29)**; not NAVD88 |
| Reach coverage | Preliminary | Model review reports Ohio River mile 846–773; GIS overlay still required |
| Study purpose | Context | FIS effective 2014-11-05, Uniontown Pool |
| Spatial compatibility | PENDING | Confirm horizontal CRS, coordinates, reach coverage, and vertical transformation |
| Qualified approval | PENDING | Reviewer sign-off required before execution |

### Critical datum gate

The model uses **NGVD29**. Do not mix its elevations with NAVD88 terrain or boundary conditions without an authoritative vertical-datum transformation. Do not use a generic regional offset; transformation values depend on location and the applicable datum realization.

## Model 8778: Unnamed Ohio River Tributary

**File:** `model-8778-UNTOhioRiver.zip`  
**SHA-256:** `56c60975f0511d6b9f306193c57e7b0b3690139e22c07c0b08c0957e2407b400`

- Archive CRC validation passed; project and geometry files are present.
- Catalog identifies HEC-RAS 4.1.0 and APPROX_ZoneA. Treat as approximate context, not as a detailed effective regulatory model.
- Text metadata indicates StatePlane, zone 2966, NAD83; the GIS vertical-datum field is blank.
- Exact horizontal CRS, vertical datum, model extent, and boundary conditions remain to be verified.

## Model 3551: Ethanol Plant Permit Model

**File:** `model-3551-ABENGOA.zip`  
**SHA-256:** `4d29e9d9f0162c9f38141c257c075dd8d53e34c044a213bfa61f15425ae0d8aa`

- Archive CRC validation passed; project, geometry, flow/plan, and output files are present. The archive is **not output-only**.
- Catalog identifies HEC-RAS 3.1.3 and a project-specific permit model.
- Text metadata indicates StatePlane and NAD83, but the GIS projection-zone field is blank.
- The project states NAVD 1988; the separate GIS vertical-datum field is blank. Resolve this metadata gap before reuse.
- Verify current conditions and permit-specific assumptions before considering any reuse.

## Summary and release gates

- **4449:** strongest initial regulatory reference candidate, but NGVD29-to-target-datum transformation and independent spatial verification are mandatory.
- **8778:** approximate Zone A model; contextual use only until purpose and limitations are reviewed.
- **3551:** project/geometry are present, but it is a permit-specific model and needs CRS/datum and applicability review.
- All three archives passed CRC validation and have full SHA-256 digests recorded.
- Spatial overlap, current regulatory status, boundary-condition adequacy, solver-version compatibility, and qualified reviewer approval remain unverified.

No archive is approved for execution, and no flood-depth/design conclusion is authorized by this review.
