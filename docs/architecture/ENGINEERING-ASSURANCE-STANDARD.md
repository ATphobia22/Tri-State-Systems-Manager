# TSM Engineering Assurance Standard

**Status:** Technical acceptance standard; version-controlled and evidence-driven  
**Applies to:** TSM software, data adapters, geospatial products, modeling workflows, and published engineering decision-support outputs  
**Purpose:** Make claims measurable, reproducible, and appropriately bounded for personal and community use.

This standard is a technical quality contract. It is not a memorial, governance charter, blanket runtime prohibition, professional license, agency approval, or claim that TSM is already validated for every engineering discipline.

## 1. Evidence classes

Every material output must identify its evidence class:

- **OBSERVED** — retrieved from an identified source, with observation/acquisition time, source identifier, units, quality flags, and source-specific semantics.
- **DERIVED** — calculated from identified inputs using a named method, version, parameters, units, and transformation history.
- **SCENARIO** — a hypothetical or forecast result with explicit assumptions, forcing data, model/configuration version, run time, and uncertainty/limitations.
- **REGULATORY** — an authoritative agency or legally recognized determination, cited to the issuing body and exact artifact/version. A TSM visualization or model result must never be relabeled as regulatory evidence.

A display layer, adapter, successful HTTP response, passing fixture, or checksum by itself does not establish source authenticity, scientific validity, survey accuracy, or regulatory status.

## 2. Required provenance for scientific outputs

Where applicable, persist and expose:

1. Source organization, dataset/product identifier, URI, retrieval time, source observation time, and license/usage constraints.
2. Coordinate reference system, axis order, units, coordinate epoch when relevant, vertical datum, and any transformation model/grid/version.
3. Data resolution, coverage, nodata semantics, quality flags, and known limitations.
4. Input manifest and cryptographic digests; software, model, and configuration versions; deterministic seed when applicable.
5. Processing steps, parameter values, output digest, and a stable run identifier.
6. Uncertainty, validation method, reference dataset, and the population/conditions for which the result is supported.

If a field is not applicable, record that explicitly with a reason; do not silently omit material metadata or infer a value.

## 3. Runtime behavior

- **Unavailable/degraded:** Missing service, unreachable endpoint, absent dataset, or unsupported runtime must be represented explicitly and scoped to the affected operation. Unrelated functions should remain usable where safe.
- **Invalid:** Malformed geometry, non-finite values, incompatible units/datums, contradictory station identity, failed integrity check, or out-of-domain inputs must not be used as valid scientific evidence.
- **Unverified:** A structurally consistent record whose origin or meaning has not been independently established must remain unverified.
- **Partial:** Incomplete coverage or partial acquisition must report coverage and omissions; do not imply completeness.
- **Recovery:** Retry/backoff and caching must preserve timestamps, freshness, provenance, and source errors. Cached data must be labeled with its age and must not be presented as current.

These are data-integrity behaviors, not a blanket requirement to stop the entire application whenever a dependency is missing.

## 4. Numerical and scientific validation

For each scientific workflow, maintain a domain-specific validation suite containing, as relevant:

- Unit and dimensional checks, range/domain checks, and explicit nodata handling.
- Analytic or independently computed reference cases.
- Boundary, degenerate, extreme, and malformed-input tests.
- Sensitivity analysis for material parameters and assumptions.
- Error metrics with units, reference source, sample size, spatial/temporal coverage, and acceptance thresholds declared before evaluation.
- Uncertainty budgets or a clear statement of which uncertainty sources remain unquantified.
- Reproducibility evidence: pinned configuration/dependencies, saved inputs, version identifiers, and rerun instructions.

A test fixture proves behavior only for that fixture. A successful build proves compilation/bundling, not numerical accuracy. A benchmark claim requires repeatable measurements against a stated baseline on the same inputs and hardware/conditions.

## 5. Release evidence levels

| Level | Minimum evidence | Permitted claim |
|---|---|---|
| L0 — Scaffold | Code/design exists; behavior not demonstrated | Experimental/scaffold only |
| L1 — Contract-tested | Automated tests pass for declared contracts and fixtures | Contract-tested; not field-validated |
| L2 — Reproducible | Inputs/configuration/version retained; run can be reproduced | Reproducible for the recorded case |
| L3 — Independently validated | Comparison against trusted independent references, declared metrics and thresholds | Validated only for the stated domain and conditions |
| L4 — Operationally monitored | L3 plus production telemetry, freshness/coverage checks, recovery and incident procedures | Operationally monitored within stated limits |

A capability may have different levels for different regions, datasets, hardware, and use cases. Do not promote a capability based solely on file presence or a green unrelated workflow.

## 6. Hydrology and geospatial minimums

For flood, terrain, water-level, or HEC-RAS-related outputs:

- Preserve the distinction between station altitude, gage height, gage-zero elevation, and water-surface elevation.
- Do not convert source gage height to NAVD88 water-surface elevation without a verified station/product-specific datum relationship and appropriate units.
- Validate AOI/watershed geometry, CRS, topology, area, coverage, and provenance.
- Record DEM source, acquisition date, resolution, horizontal CRS, vertical datum/units, nodata handling, and verified checksum.
- Record solver identity/version, model configuration, boundary/initial conditions, forcing data, input/output artifacts, and run status.
- Distinguish a screening result or engineering-review-ready evidence package from a completed solver run, professional certification, agency approval, and regulatory determination.

PE licensure is not a prerequisite for TSM software to execute technical workflows. Professional review or a sealed deliverable may be required for particular work under applicable law, contract, or agency requirements; that is separate from software runtime.

## 7. Community-facing and emergency communication

- Never label TSM as an official warning authority unless a specific authorized integration and its operational obligations have been established.
- Show source time, last successful retrieval, freshness, coverage, uncertainty, and limitations beside consequential live data.
- Direct emergency decisions to current official alerts and local emergency-management instructions.
- Use accessible language, keyboard-accessible controls, meaningful contrast, and non-color-only status indicators.
- Avoid exposing personal, precise-location, or infrastructure-sensitive data unless necessary and authorized.

## 8. Measurable release checklist

A release candidate is ready for technical review only when the applicable items below have evidence linked in CI or release documentation:

- [ ] Build and typecheck pass on the exact commit.
- [ ] Unit/contract tests pass, including missing, invalid, and degraded-input cases.
- [ ] Security/dependency and secret checks pass or have documented, scoped exceptions.
- [ ] Scientific acceptance tests and declared thresholds pass for each claimed validated capability.
- [ ] Provenance and units/datum metadata are present for material outputs.
- [ ] Accessibility, browser/runtime support, and performance are tested for the declared support matrix.
- [ ] Production smoke test verifies the deployed artifact corresponds to the intended commit.
- [ ] Remaining limitations and unsupported claims are documented and visible to users.

If an item is not applicable, state why. If evidence is missing, report it as unverified rather than claiming success.

## 9. Claims and public status

Use precise status labels: **scaffold**, **contract-tested**, **reproducible**, **independently validated**, **operationally monitored**, **unavailable**, and **not complete**. Each label must point to evidence and a scope. TSM should earn broader trust through published interfaces, reproducible tests, independent comparison, transparent limitations, and measured outcomes—not self-declared authority.

## 10. Change control

Changes to acceptance thresholds must identify the affected workflow, rationale, reference evidence, and compatibility impact. Do not weaken a threshold solely to turn a failing build green. CI results must be associated with the exact commit and must not be inferred from a prior SHA.
