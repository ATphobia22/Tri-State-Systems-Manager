# Ohio River Hydraulic Models — Posey County, Indiana

**Source:** Indiana DNR Water Division Model Library  
**Catalog download date:** 2026-10-17  
**Archive validation:** [CI run 39079514563](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39079514563)

| Archive | Model ID | Size (bytes) | Full SHA-256 | Catalog classification |
|---|---:|---:|---|---|
| `model-4449-JTMyers-FIS.zip` | 4449 | 211,338 | `938dd9e593f6554b1b7d7095ff11eecc4862bf6c8a6966e88fd6db7f7ff5a7f6` | Ohio River FIS; HEC-RAS 3.1.3; JT Myers Pool; effective 2014-11-05 |
| `model-8778-UNTOhioRiver.zip` | 8778 | 236,064 | `56c60975f0511d6b9f306193c57e7b0b3690139e22c07c0b08c0957e2407b400` | Unnamed tributary to Ohio River; HEC-RAS 4.1.0; approximate Zone A |
| `model-3551-ABENGOA.zip` | 3551 | 979,882 | `4d29e9d9f0162c9f38141c257c075dd8d53e34c044a213bfa61f15425ae0d8aa` | Unnamed tributary; HEC-RAS 3.1.3; ethanol plant permit model |

## Integrity and structure

All three archives passed ZIP CRC validation and contain a HEC-RAS project file plus geometry files.

- **4449:** `jtmyers.prj`, `jtmyers.g01`, flow/plan files and output files.
- **8778:** `untohioriver#5.prj`, `untohioriver#5.g01`, flow/plan files and output files.
- **3551:** `abengoa_unt_jmk.prj`, geometry files `.g02/.g04/.g05`, flow/plan files and outputs. **This archive is not output-only.**

## CRS and vertical datum

- **4449:** Model review identifies **NGVD 1929 (NGVD29)**. Do not mix these elevations with NAVD88 terrain without a verified vertical-datum transformation. The conversion is location-dependent; do not apply a generic offset. Horizontal CRS evidence was not found by the bounded text scan.
- **8778:** Text metadata states `GIS Map Projection=STATEPLANE`, `GIS Projection Zone=2966`, and `GIS Datum=NAD83`. Its `GIS Vertical Datum=` field is blank.
- **3551:** Text metadata states `GIS Map Projection=STATEPLANE` and `GIS Datum=NAD83`; the GIS projection-zone field is blank. The project states `Model Vertical Datum is NAVD 1988`, while the separate GIS vertical-datum field is blank.

The Model 4449 review reports an Ohio River reach spanning river miles 846–773; the spatial overlay against the candidate AOI remains pending.

## Acceptance status

- [x] ZIP CRC validation and full SHA-256 hashes
- [x] Project/geometry/flow-plan/output file inventory
- [x] Literal CRS and datum clues recorded
- [ ] Verify exact horizontal CRS, coordinate units, and model extents in a format-aware GIS workflow
- [ ] Confirm vertical datum and elevation units; use a documented transformation where required
- [ ] Compare model reach/extent to a separately sourced AOI in a common, verified CRS
- [ ] Verify current effective status and any superseding FIS/FIRM records
- [ ] Review upstream/downstream boundary conditions, calibration, assumptions, and software compatibility
- [ ] Qualified hydraulic reviewer approval

**None of these archives is approved for execution or for flood-depth/design conclusions.**
