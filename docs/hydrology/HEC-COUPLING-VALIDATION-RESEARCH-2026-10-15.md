# HEC-HMS → HEC-RAS Coupling Validation Research

**Reviewed:** 2026-10-15  
**Purpose:** Translate current USACE documentation, versioned integration APIs, and relevant flood-model research into release criteria for Tri-State Systems Manager (TSM).  
**Status:** Research and software-contract changes only. This document does not certify a model run or a Tri-State pilot watershed.

## Executive decision

TSM should treat the HMS-to-RAS handoff as a separately testable engineering interface. The handoff must prove that the exact chosen HEC-DSS `FLOW` record was read, its time axis and units were qualified, the declared conversion was applied, the target DSS record was written and read back, and the intended RAS boundary file references that record. A passing handoff is **not** hydrologic calibration, hydraulic validation, uncertainty qualification, or professional approval.

This follows the distinction in the [HEC-HMS Validation Guide](https://www.hec.usace.army.mil/confluence/hmsdocs/hmsvg/latest/validation-guide): software code validation addresses whether the program correctly implements its equations, whereas selecting and configuring components for an individual watershed requires a separate engineering calibration/verification process. HEC software-level validation cannot certify a specific TSM application.

## Contract changes made for the handoff

The pinned adapter is in `scripts/hydrology/hms-ras-handoff.py`. The coupled runner is in `scripts/hydrology/run-hec-coupled-workflow.mjs`.

- **Exact source selection:** the source DSS pathname is explicit and must be present in the HMS catalog. The adapter does not choose the first matching record.
- **Semantics and units:** only a `FLOW` record is accepted. The source element, run identifier, interval, declared source units, target units, and explicit conversion method must agree. Conversions currently support CFS↔CMS and same-unit pass-through with fixed method identifiers.
- **Time axis:** timestamps must be strictly increasing, on whole-minute boundaries and on the declared regular interval. Gaps, duplicates, ambiguous/nonexistent local times, and UTC-offset changes within a series are rejected. The adapter does not interpolate or synthesize flow values.
- **Quality checks:** flow values must be finite and non-negative. This policy is conservative; a case that legitimately requires reverse flow needs an explicitly designed and reviewed contract change, not an implicit relaxation.
- **Post-write read-back:** after writing the exact target record, the adapter reads that exact record back from the target DSS file and compares target timestamps and discharge values with the intended series. The accepted per-value tolerance is `max(1e-6, 1e-5 × max(abs(expected flow), 1.0))` in the declared target flow units. This is a file-transfer/representation tolerance, **not** an acceptable hydrologic forecast error or a model calibration threshold.
- **Boundary evidence:** the target pathname is checked in the DSS catalog, the RAS boundary is changed through an exact selector, and a report retains source/target hashes, package versions and commits, series summary, target pathname and the staged `.uNN` hash.
- **Failure signaling:** a failed coupled run writes a `FAILED_OR_BLOCKED` receipt and now propagates the error to a non-zero process status so a scheduler cannot interpret a failed run as success.
- **Interpretation:** the run stays `COMPLETED_UNVALIDATED` after successful computation. A handoff status such as `HANDOFF_WRITTEN_AND_STRUCTURALLY_CHECKED_HYDROLOGY_UNVALIDATED` describes contract checks, not the physical truth of the result.

The tests added here use synthetic in-memory time series to exercise read-back criteria and negative cases; they do not substitute for a real HEC-DSS integration test on a worker with the pinned HEC and Java dependencies.

## Research implications for scientific release gates

### 1. Validate more than pixel overlap

Travert et al. studied comparison measures for flood models against satellite-derived flood extents and found that spatial observation errors, small position shifts, and the choice of scoring metric can change evaluation and calibration conclusions. They recommend assessing metrics against the relevant observation errors rather than treating one pixel-wise score as universal. For TSM, compare model extents to time-matched observations only after validating CRS, georeferencing, acquisition time, and reference-data uncertainty. Use multiple complementary extent diagnostics; retain stage/discharge residuals and hydraulic diagnostics rather than collapsing acceptance to a single overlap score.

### 2. Carry forcing uncertainty through the model chain

Nguyen et al. study a chained hydrologic/hydraulic forecasting system using hydrologic forcing, in-situ water-surface elevation, and satellite-derived flood extent observations. Their analysis motivates testing uncertainty in forcing data and state/parameter estimates, and using complementary observation types. Their case uses RAPID and TELEMAC-2D rather than HEC-HMS/HEC-RAS, so it is evidence for the *validation approach*, not a drop-in TSM benchmark.

Kazma and Taha present a distribution-agnostic state-space approach to uncertainty propagation in coupled hydrologic/hydrodynamic systems and compare it with Monte Carlo ensembles in synthetic and real-world catchments. This 2026 preprint is an implementation research lead, not a USACE acceptance standard. For the first TSM AOI, a proportionate path is sensitivity analysis across defensible rainfall/initial-condition/roughness ranges, then an ensemble or another documented uncertainty method justified by model size and decision use. Report uncertainty alongside results; do not invent confidence intervals from a single deterministic run.

### 3. Keep the validation layers separate

| Layer | Evidence required | Does not establish |
|---|---|---|
| Adapter contract | Exact DSS catalog path, units, regular time axis, read-back values, boundary linkage, hashes | Valid runoff or valid hydraulics |
| Software/run integrity | Pinned software/adapter identity, source-package hashes, fresh output checks, solver diagnostics and result artifact integrity | Watershed representativeness |
| Hydrologic model validation | Event-specific calibration/verification against independent gage discharge/volume/timing and other appropriate observations | Hydraulic floodplain accuracy |
| Hydraulic model validation | Correct terrain/geometry/datum, boundary conditions, stability/convergence, mass-balance review, and comparisons to independent WSE/high-water marks/flood extents where available | Uncertainty characterization or legal/regulatory acceptance |
| Uncertainty and review | Sensitivity/ensemble methodology, limitations, independent qualified engineering review and documented disposition | Agency acceptance unless the agency actually issues it |

The [HEC-RAS boundary-condition guidance](https://www.hec.usace.army.mil/confluence/rasdocs/rasum/6.1/performing-a-1d-unsteady-flow-analysis/entering-and-editing-unsteady-flow-data/boundary-conditions) states that inline flow-hydrograph data uses regular intervals and discusses flow-change-related numerical stability. That page is version-tagged 6.1; confirm details against the exact HEC-RAS release and plan configuration installed on the approved worker.

## Required evidence before an AOI run may pass

1. Approved AOI geometry and watershed delineation, with verifiable hashes and independent review of the delineation.
2. Source-qualified forcing and observations with provenance, valid times, units, coordinate reference system, vertical datum where applicable, and source terms/licensing.
3. Exact HMS/RAS versions, platform and runtime evidence, adapter launcher/script hashes, and immutable HEC project package hashes.
4. A real run receipt containing both stages, all outputs and their hashes, transfer report/read-back status, and HEC-RAS solver/HDF diagnostics.
5. Independent hydrologic calibration/verification and hydraulic validation evidence, with metrics chosen for the AOI and intended use; no single universal metric or tolerance is assumed.
6. Explicit uncertainty/sensitivity assessment and qualified reviewer sign-off.
7. Regulatory/agency status kept separate from TSM computation status.

## Sources reviewed

- USACE Hydrologic Engineering Center. [HEC-HMS Validation Guide](https://www.hec.usace.army.mil/confluence/hmsdocs/hmsvg/latest/validation-guide). Primary documentation for the distinction between code validation and watershed-application calibration/verification, including known-solution tests and unit-conversion/interpolation checks.
- USACE Hydrologic Engineering Center. [HEC-RAS User's Manual: Boundary Conditions (version-tagged 6.1 page)](https://www.hec.usace.army.mil/confluence/rasdocs/rasum/6.1/performing-a-1d-unsteady-flow-analysis/entering-and-editing-unsteady-flow-data/boundary-conditions). Primary documentation for regular time-series intervals and flow-boundary stability considerations.
- Travert, J.-P., Boyaval, S., Goeury, C., Bacchi, V., & Zaoui, F. (2024). *Evaluation of performance measures for qualifying flood models with satellite observations*. arXiv preprint. https://arxiv.org/abs/2408.00571
- Nguyen, T. H., Ricci, S., Piacentini, A., Bonassies, Q., Rodriguez Suquet, R., Peña Luque, S., Marlis, K., & David, C. H. (2023). *Reducing uncertainties of a chained hydrologic-hydraulic model to improve flood forecasting using multi-source Earth observation data*. arXiv preprint. https://arxiv.org/abs/2306.10059
- Kazma, M. H., & Taha, A. F. (2026). *Exploring uncertainty propagation in coupled hydrologic and hydrodynamic systems via distribution-agnostic state space analysis*. arXiv preprint. https://arxiv.org/abs/2603.05740
- HEC-RAS integration API reference: [RAS Commander HMS-RAS coupled workflow example](https://github.com/gpt-cmdr/ras-commander/blob/main/examples/918_hms_ras_coupled_forecast.ipynb) and [DSS time-series API](https://github.com/gpt-cmdr/ras-commander/blob/main/ras_commander/dss/RasDss.py). These are implementation references, not USACE policy.
- HEC-HMS integration API reference: [HMS Results](https://github.com/ATphobia22/hms-commander/blob/main/hms_commander/HmsResults.py). This illustrates explicit element/run selection; TSM's actual implementation dependencies remain pinned to the commits declared in `hms-ras-handoff.py`.

## Evidence limitations as of this review

No pilot AOI was approved by this research task. No real project input package, installed HEC runtime, HEC-DSS output, HEC-RAS HDF result, calibration set, or independent engineering review was verified here. Repository contract tests must pass in CI, and an actual HEC worker run must be separately evidenced before a scientific or deployment gate can be closed. The 2024 and 2026 research items above are preprints and are used as methodological evidence, not as substitutes for agency manuals or professional judgement.
