# Open-source hydrology, hydraulics and culvert-energy integration

**Status:** credential-free integration contracts and adoption registry; most solver adapters are catalog-only.  
**Updated:** 2026-10-24  
**Safety boundary:** TSM is engineering decision support. No solver run, culvert design, energy yield, regulatory determination, or site approval is implied by these contracts.

## Scope and architecture

The machine-readable inventory is `integrations/hydrology-engine-adapters.json`. It separates model family, interface type, inputs/outputs, status, and validation gates. The broader `integrations/open-source-engine-registry.json` records project links, license notes, credentials, and adoption role. CI validates both registries. The contracts intentionally do not install binaries, start services, fetch large datasets, or enable solver execution by default.

Recommended workflow:

1. Acquire licensed, source-identified observations and terrain/hydrography with retrieval time, quality flags, CRS, vertical datum, units, and SHA-256.
2. Define the study AOI, catchment/outlet, model domain, intended use, and reviewer separately. A location/address alone cannot approve an AOI.
3. Build immutable input manifests and versioned model configurations.
4. Execute only an explicitly configured, version-pinned adapter with resource limits and captured stdout/stderr.
5. Retain exit status, model version evidence, input/configuration/output hashes, run timestamps, logs, and numerical diagnostics.
6. Evaluate against known-answer fixtures, benchmark cases and/or observations; record uncertainty and calibration status. Require qualified human review before any engineering use.
7. Publish model output as a clearly labeled derived layer with source lineage and scenario/time metadata. Rendering success is not scientific validation.

## Solver and data-tool roles

| Tool | Intended role | Integration status in this change |
|---|---|---|
| EPA SWMM | Urban rainfall-runoff and drainage network modelling | Catalog-only |
| Delft3D-FLOW | Surface-water hydrodynamics and sediment processes | Catalog-only |
| ANUGA | Shallow-water/inundation modelling | Catalog-only |
| MODFLOW 6 + FloPy | Groundwater simulation and Python model construction/post-processing | Catalog-only |
| OpenGeoSys / Elmer FEM | Specialist coupled porous-media or multiphysics problems | Catalog-only |
| BMI Python | Common lifecycle/variable interface for compatible model coupling | Catalog-only |
| HydroErr | Evaluation metrics for observed vs simulated hydrologic series | Catalog-only |
| PyRAD | Radar processing/QPE research pipeline | Catalog-only |
| OpenFOAM + turbinesFoam | Specialist CFD and actuator-line turbine modelling | OpenFOAM prototype runner exists; not a validated turbine adapter |
| DualSPHysics | Specialist free-surface SPH and wave-impact studies | Catalog-only |
| OpenFAST + ROSCO | Turbine structural/control dynamics; mostly wind/offshore context | Catalog-only; not a river-hydrology replacement |
| windpowerlib | Wind energy-yield estimation | Catalog-only; not a hydrokinetic model |
| HEC-RAS | Existing external 1D/2D hydraulic software integration | External software; not open-source |

For common map and data services, retain MapLibre + Three.js + CesiumJS, PostGIS/Martin for configured dynamic tiles, PMTiles for versioned offline artifacts, GDAL/PROJ for reproducible transformations, H3 for derived aggregation, and optional Protomaps basemap builds. BullMQ is only useful if Redis is provisioned; TimescaleDB is optional if PostgreSQL/time-series operations justify it. Neither queue acceptance nor time-series storage makes a model scientifically valid. TimescaleDB licensing is release/feature-dependent; review the upstream Apache-2.0 and TSL terms before bundling.

## Culvert micro-hydropower proposal: evidence boundary

Reference repository: [Sumit77884 — culvert hydro-power Bihar Government proposal](https://github.com/Sumit77884/culvert-hydro-power--Bihar-Government-Proposal--At-IIT-PATNA-). Its public README describes a proposed 5–10 kW low-head rotary-turbine concept and a 440 V AC output. The repository inventory includes a proposal PDF plus certificate/offer-letter files, but no source code, machine-readable hydraulic model, public license declaration, site-specific flow series, turbine performance curve, or independent validation evidence was found in the repository metadata inspected for this integration. TSM does not copy those personal documents or incorporate their claims as verified design data.

A transparent first-pass hydraulic-power equation is:

\[
P_{hydraulic}=\rho g Q H_{net}, \qquad
P_{electric}=\rho g Q H_{net}\eta_{total}
\]

where \(Q\) is the flow actually available through the turbine after required conveyance/environmental-flow constraints, \(H_{net}\) is verified net head after losses, and \(\eta_{total}\) is a documented combined efficiency between 0 and 1. The new `estimateHydraulicPower` helper returns a **screening-only** estimate from supplied values; it does not infer them, predict annual energy, or qualify a site.

Before a site-specific claim can be considered, evidence is required for at least:

- Flow-duration and seasonal low-flow/high-flow records, design flood conditions, uncertainty, and an environmental-flow/passage assessment.
- Surveyed culvert geometry, elevations/datum, head-loss calculations, debris/sediment/scour conditions, and hydraulic capacity with and without the device.
- Manufacturer turbine performance curves at the relevant head/flow range, generator/inverter/control efficiency, protection, grounding, and electrical-code review.
- Structural and roadway loading, blockage risk, debris/flood conveyance, maintenance access, fish passage/ecology, permits, ownership, and emergency bypass/fail-safe conditions.
- Independent hydraulic review, sensitivity analysis, and field measurements or suitable validated reference cases.

A 5–10 kW proposal headline or an ideal-power equation is not evidence that a particular culvert can safely produce that power. Do not change culvert structure, narrow flood conveyance, or make a public-safety or financial decision from the screening helper alone.

## Credential-free implementation boundary

No API key, account, password, paid hosted service, or automatic dependency installation is introduced. Public documentation and open-source repositories are reference sources; actual model execution remains disabled until an operator supplies a validated local runtime and model inputs. External services and large datasets are not fetched in CI.

## References

- [EPA SWMM](https://www.epa.gov/water-research/storm-water-management-model-swmm)
- [USGS MODFLOW 6](https://www.usgs.gov/software/modflow-6-usgs-modular-hydrologic-model)
- [FloPy](https://github.com/modflowpy/flopy)
- [ANUGA](https://github.com/GeoscienceAustralia/anuga_core)
- [Delft3D](https://github.com/Deltares/Delft3D)
- [CSDMS BMI Python](https://github.com/csdms/bmi-python)
- [HydroErr](https://github.com/ThibHlln/HydroErr)
- [MeteoSwiss PyRAD](https://github.com/MeteoSwiss/pyrad)
- [OpenFOAM](https://github.com/OpenFOAM/OpenFOAM-dev) · [turbinesFoam](https://github.com/turbinesFoam/turbinesFoam)
- [DualSPHysics](https://github.com/DualSPHysics/DualSPHysics) · [Elmer FEM](https://github.com/ElmerCSC/elmerfem)
- [OpenFAST](https://github.com/OpenFAST/openfast) · [ROSCO](https://github.com/NREL/ROSCO)
- [Hydraulic modelling best practice and uncertainty](https://www.gov.uk/government/publications/river-modelling-technical-standards-and-assessment/hydraulic-modelling-best-practice-model-approach)
