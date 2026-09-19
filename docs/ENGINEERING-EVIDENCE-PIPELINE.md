# TSM Evidence-Gated Engineering Pipeline

**Status:** Active repository contract  
**Purpose:** Prevent a modeled result, funding assumption, or regulatory statement from outrunning its required evidence.

## Canonical sequence

1. **Authoritative terrain** — retain source URI, acquisition/product metadata, horizontal CRS, vertical datum, units, grid alignment and content hash.
2. **Verified bathymetry / topobathy** — require surveyed channel information or authoritative topobathymetry where submerged terrain affects hydraulics. A LiDAR/DEM water surface is not accepted as channel-bed truth.
3. **Datum control** — explicitly document horizontal/vertical reference, geoid/transformation method, units and survey control.
4. **Baseline HEC-RAS** — construct the baseline from the verified terrain/bathymetry/datum chain. Terrain modifications are scenario inputs, not source data.
5. **Calibrated hydrology/hydraulics** — distinguish observed data, boundary conditions, calibration parameters and model outputs. Calibration and validation evidence are separate artifacts.
6. **Alternative scenarios** — evaluate dredge, levee/high-ground, pump/structure and combined alternatives against the same baseline.
7. **Independent earthwork** — calculate cut/fill from explicitly aligned baseline/proposed surfaces and exact footprint masks. Verify horizontal and vertical units before reporting volume.
8. **Sediment suitability** — characterize geotechnical and environmental properties before treating dredged material as structural fill. Volume balance never proves structural suitability.
9. **Environmental screening** — screen wetlands, CWA 401/404, ESA/critical habitat, NHPA/Section 106, NEPA and applicable Indiana/local requirements.
10. **Agency eligibility** — record the actual agency/authority determination. The system may identify candidate authorities but must not infer approval or eligibility from a model result.
11. **Benefit-cost analysis** — use the current program-specific methodology, documented benefits, useful life, discounting, uncertainty and residual risk.
12. **Funding applications** — calculate only verified allowable costs and current cost-share rules. Competitive programs and tax credits remain separate from engineering evidence.
13. **Independent QA/QC** — reproduce the terrain, hydraulic, earthwork and BCA calculations and retain the final evidence manifest.

## Fail-closed invariants

- No downstream stage may be verified or approved while a required upstream stage is blocked.
- Bathymetry is a separate evidence class from terrain.
- No vertical datum conversion may be silent.
- No sediment source is presumed to be structural fill.
- No agency eligibility is inferred from a simulation.
- No funding amount is treated as an award.
- Program-specific cost shares and deadlines are mutable, source-backed data.
- Human engineering/regulatory review remains authoritative.

## Current funding guardrails

- **USACE Section 204:** conditional authority tied to qualifying dredging associated with an existing authorized Federal navigation project; do not treat it as generic levee/road funding.
- **FEMA BRIC:** cycle-specific; the verified FY2024–FY2025 record is closed, so future cycles require live NOFO verification.
- **USDA REAP:** current USDA guidance allows up to 50% federal share for qualifying categories, but the renewable-energy grant request maximum is $1 million.
- **IRC §48E / §6417:** not a universal percentage refund. Credit amount and elective-pay eligibility depend on the qualified property, entity status and statutory requirements.
- **HUD CDBG:** 24 CFR 570.201(g) can support a non-Federal share only when the underlying activity is otherwise CDBG-eligible and the other Federal program does not prohibit the use.

## Evidence model

Every stage should point to immutable evidence identifiers. Derived artifacts must preserve:

- source authority;
- retrieval timestamp;
- transformation chain;
- CRS and vertical datum;
- units;
- content hash;
- validation status;
- human-review status;
- known limitations.

The repository contract is implemented by data/engineering/evidence-pipeline-contract.json, data/schemas/engineering-evidence-pipeline-v1.schema.json, and scripts/ci/validate-engineering-pipeline.mjs.