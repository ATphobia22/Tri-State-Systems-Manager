# McFadden Creek Hydraulic Models — Posey County, Indiana

**Source:** Indiana DNR Water Division Model Library  
**Catalog download date:** 2026-10-17  
**Archive validation:** [CI run 39079514563](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39079514563)

| Archive | Model ID | Date / engineer | HEC-RAS / type | Size (bytes) | Full SHA-256 |
|---|---:|---|---|---:|---|
| `model-9917-Final_Model.zip` | 9917 | 2018-01-07 / Wessler Engineering | 4.1.0 / FARA | 54,752 | `5bbc900416edc4ed6844235ea0c878f285d30e41977e8b1d0225129e28f2b4b2` |
| `model-9928-MR-35369.zip` | 9928 | 2018-01-07 / Wessler Engineering | 4.1.0 / FARA | 9,189 | `4b8ca4f6d6a5c31b0b84bc57ceba96cb86a5fa43bede95490e03e7ab039858b3` |
| `model-6149.zip` | 6149 | 2015-05-31 / IDNR Division of Water | 4.1.0 / APPROX_ZoneA | 2,208,510 | `2493f4c3450deaf1f6cc935a39dabff66d414e161b49b5a3cfd452e400958fbc` |
| `model-1738.zip` | 1738 | 1996-08-29 / Three I Engineering | Version not established / PERMIT | 3,649 | `b45487fc49c5ab62f32b3332a8037c7d9eb49c267522016b130db4bf9117ca9c` |
| `model-653.zip` | 653 | 1997-01-22 / Three I Engineering | Version not established / FARA | 6,184 | `68ed2f4ad2d621e4c2045c85c61dde4b1a16441b572427dc741c19ee2b6c870a` |

## Integrity, structure, and CRS clues

All five archives passed ZIP CRC validation and contain a project file plus at least one HEC-RAS geometry file.

- **6149:** literal metadata says `GIS Map Projection=STATEPLANE`, `GIS Projection Zone=2966`, and `GIS Datum=NAD83`; its `GIS Vertical Datum=` field is blank.
- **9917, 9928, 1738, 653:** the bounded text scan found no explicit horizontal CRS or vertical datum evidence. This means not found in scanned text, not proof that no supporting metadata exists.
- **9917 vs 9928:** catalog records describe the same project family. Compare model geometry, scenarios, and revision details before treating them as interchangeable.

## Acceptance status

- [x] ZIP CRC validation and full SHA-256 hashes
- [x] Project/geometry/flow-plan/output file inventory
- [x] CRS/datum clues and gaps recorded
- [ ] Confirm exact horizontal CRS, coordinate units, and vertical datum for each model
- [ ] Compare 9917 and 9928 project/geometry differences
- [ ] Verify model reach/extent overlap with the intended AOI in a common, authoritative CRS
- [ ] Review boundary conditions, calibration/validation, effective status, and software compatibility
- [ ] Qualified hydraulic reviewer approval

Model 3903 (HDR Engineering, HEC-RAS 4.0, PERMIT) was not included in the eight validated archives; its prior retrieval attempt remains unconfirmed. The inventory found no DNR-library model for the Wabash River at New Harmony in the searched catalog, which is not proof that no model exists elsewhere.

**These are candidate source artifacts only, not approved model inputs.**
