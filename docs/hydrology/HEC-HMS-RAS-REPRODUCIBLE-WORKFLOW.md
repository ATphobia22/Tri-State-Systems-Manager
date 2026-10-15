# Reproducible HEC-HMS → HEC-RAS run workflow (manifest v2)

## Current state

The repository now defines a fail-closed v2 run-manifest contract, an execution-readiness validator, a reproducible orchestration runner, a DSS-to-HEC-RAS boundary handoff adapter, local content-addressed artifact capture, and regression tests for handoff rules.

**No real coupled HEC simulation is claimed.** The checked-in manifest example is DRAFT, its hashes and runtime paths are placeholders, and no approved pilot AOI or qualified source model package was provided in this implementation request. The first design simulation must remain blocked until the area, inputs, model packages, installed runtimes, transfer selector, and qualified engineering review are evidenced.

## Official product and adapter versions

As checked 2026-10-15:

- The USACE HEC-HMS download/docs pages list HEC-HMS 4.14, with its final release noted as 2026-09-28. Verify the [download page](https://www.hec.usace.army.mil/software/hec-hms/downloads.aspx) and matching [4.14 release notes](https://www.hec.usace.army.mil/confluence/hmsdocs/hmsum/4.14/release-notes/v-4-14-0-release-notes) on the execution host.
- The USACE download page lists HEC-RAS 7.0.1, released 2026-06-02; the current package is a Windows 10/11 x64 setup, with Linux compute-engine support through the packaged Windows/WSL workflow. Verify the [download page](https://www.hec.usace.army.mil/software/hec-ras/download.aspx) and [release notes](https://www.hec.usace.army.mil/confluence/rasdocs/rasrn/latest).
- The adapter pins hms-commander 0.4.0 from the exact TSM-user fork commit [1404fee5c81820764197f38923764f8c1d1b2fb7](https://github.com/ATphobia22/hms-commander/commit/1404fee5c81820764197f38923764f8c1d1b2fb7), and ras-commander 0.105.0 from [574adbc725f9436a196698970febe39d98ef30c5](https://github.com/gpt-cmdr/ras-commander/commit/574adbc725f9436a196698970febe39d98ef30c5). The public PyPI JSON currently reports hms-commander 0.3.1, so do not assume pip's default PyPI release is the required 0.4.0 interface. Install the exact VCS references from scripts/hydrology/requirements-hec-handoff.txt. The handoff checks PEP 610 direct_url.json at runtime and rejects missing or mismatched Git commit metadata. HMS Commander identifies itself as active/beta software that needs engineering oversight; package versions do not qualify a project or validate a model.
- The [coupled-forecast example notebook](https://github.com/gpt-cmdr/ras-commander/blob/main/examples/918_hms_ras_coupled_forecast.ipynb) is an integration pattern, not evidence that a TSM project has been run. The [HEC-HMS Technical Reference Manual (2023-10-18)](https://www.hec.usace.army.mil/software/hec-hms/documentation/HEC-HMS_Technical_Reference_Manual-20231018.pdf) supports scientific method review; it is not authorization to invent project parameters.

Do not stamp a software version into the manifest until the installed binary version and its version-evidence record are inspected on the actual H&H runner.

## Contracts and entry points

| Purpose | Path |
|---|---|
| Current contract (v2) | data/schemas/hec-coupled-run-manifest-v2.schema.json |
| DRAFT manifest template | data/schemas/examples/hec-coupled-run-manifest-v2.example.json |
| Fail-closed validation | scripts/hydrology/validate-hec-run-manifest.mjs |
| HEC-HMS-to-RAS handoff | scripts/hydrology/hms-ras-handoff.py |
| Orchestration, stage receipts and artifact blobs | scripts/hydrology/run-hec-coupled-workflow.mjs |
| Node contract/runner tests | tsm-console/tests/hec-coupled-run-manifest.test.mjs |
| Python pure handoff tests | backend/tests/test_hec_hms_ras_handoff.py |
| Immutable HMS/RAS Commander VCS dependency pins | scripts/hydrology/requirements-hec-handoff.txt |

The v1 schema and its example are retained as immutable compatibility artifacts. New runs use v2. The v2 manifest pins the source Git commit, AOI/delineation hashes, source-input provenance and quality, project-package hashes, adapter and vendor-executable hashes, version evidence, exact DSS record and selected RAS boundary, interval/time zone, units/conversion method, output paths, artifact store mode, and run timeout. Unknown fields or unsupported schema keywords fail closed.

## Workflow

1. **Prepare the evidence package.** Place the approved AOI polygon, the independently reviewed watershed delineation, and each source artifact in the operator-controlled workspace. The manifest hashes must match the exact bytes. Keep all original inputs read-only. Record source URLs/acquisition time, valid time, licensing/terms, quality state, units, CRS and vertical datum. A map viewport, live station, radar image, or a public sample watershed is not an approved design basin.
2. **Pin exact model packages.** Inventory every file referenced by the HEC-HMS project, meteorologic/basin/control/run settings, DSS dependencies, and the HEC-RAS project, geometry/terrain, unsteady flow, plan and boundary condition files. Hash the full source project tree and record the installed vendor binary hash/version. Run only from a fresh run copy; the runner verifies the source copy hash before and after.
3. **Run HEC-HMS through a version-qualified command adapter.** The command must be an explicit argv array (no shell pipeline), produce the expected non-empty DSS output under that run's isolated output directory, and retain stdout/stderr. Verify the selected simulation run and inspect warnings/errors; a zero process exit code by itself is insufficient.
4. **Transfer one explicit FLOW pathname.** The adapter searches the source DSS catalog for exactly source_dss_pathname, not the first result. It checks B/C/E/F semantics, exact units from DSS metadata, time zone and interval, increasing timestamps, no missing/duplicate/irregular intervals, no non-finite or negative values, and the declared unit conversion. It writes the target DSS pathname at the declared dss_version, validates the target pathname, reads the exact target record back, and compares timestamps and values against the intended series. The round-trip gate requires exact local/UTC timestamps, equal point count, and per-value error no greater than max(1e-6, 1e-5 × max(abs(expected), 1.0)) in target units. It then uses RasUnsteady.set_boundary_dss_link to update only the declared 1D, 2D, or indexed boundary selector. The runner independently verifies the report's source/target paths and hashes, pathname, boundary selector and read-back status against the approved manifest and staged .uNN file. It does not generate values or interpolate gaps. These are transport-integrity tolerances, not physical-model acceptance thresholds.
5. **Run HEC-RAS through a version-qualified compute adapter.** The adapter must execute the explicitly selected plan using the staged boundary condition and produce the declared fresh .hdf output. TSM verifies the HDF5 signature and hashes/logs, but that is not a substitute for examining HEC-RAS computation messages, plan time coverage, mass-balance stability, units, roughness, terrain, structures, mesh, and boundary conditions.
6. **Retain the receipts.** The orchestrator writes a FAILED_OR_BLOCKED receipt and exits non-zero when any stage or receipt check fails; downstream schedulers must not interpret an internal failure receipt as a successful process exit. Each source, input, model package, stdout/stderr log, handoff record, HEC-RAS output and final run receipt is copied into the filesystem content-addressed store keyed by lowercase SHA-256. An existing same-digest blob is re-hashed before reuse. The current implementation is local filesystem storage with metadata_store=run-manifest-only; it does not claim a shared cloud durability SLA or register database rows.
7. **Keep science and approval as separate gates.** The successful terminal state is COMPLETED_UNVALIDATED. A qualified engineer must inspect the model, calibrate against an evidence-qualified observation set, validate independently on separate observations, assess parameter sensitivity/uncertainty, document limitations and sign off before any engineering or regulatory use. A run receipt cannot promote approval by itself.

## Configure the runner

Copy the v2 example to a controlled run directory outside the checked-out source packages, then replace all placeholders with reviewed evidence. The manifest's source_commit must be the full SHA of the TSM checkout on the execution worker; supply the same value in TSM_SOURCE_COMMIT for a local run or GITHUB_SHA for the runner environment.

Every model-stage command is an argument array. Its first token is the absolute path to a reviewed adapter launcher (for example a pinned Python executable that invokes a local HEC installation); executable_sha256 hashes that launcher, while runtime_executable_path/runtime_executable_sha256 separately pin the actual HEC vendor binary. The command must use {{workspace}}, {{project}}, {{output}}, {{manifest}}, and {{runtime_executable}} placeholders, and place expected output files underneath output_directory. The actual HEC binary is passed as a command token and its SHA-256/version evidence is separately verified.

The handoff command must include all of the following exact placeholders so the orchestrator injects run-specific paths instead of trusting stale files:

- {{workspace}}, {{project}}, {{output}}, {{manifest}}
- {{source_output}}, {{ras_input}}, {{ras_dss}}, {{handoff_report}}, {{adapter_script}}

A typical argument-array shape for the pinned handoff adapter (adapt paths to the approved Python runtime, do not paste an unreviewed path into production) is:

~~~json
[
  "ABSOLUTE/PATH/TO/PINNED/PYTHON",
  "{{adapter_script}}",
  "--manifest", "{{manifest}}",
  "--workspace", "{{workspace}}",
  "--hms-dss", "{{source_output}}",
  "--ras-project", "{{project}}",
  "--ras-input", "{{ras_input}}",
  "--ras-dss", "{{ras_dss}}",
  "--report", "{{handoff_report}}"
]
~~~

Install the exact handoff dependency lock with python -m pip install -r scripts/hydrology/requirements-hec-handoff.txt in an isolated, reviewed H&H environment. The adapter verifies PEP 610 VCS commit metadata and refuses a package installed from an arbitrary PyPI release. Use the same requirements file and Python version on each worker. The adapter and each Python package version must be installed and verified on the actual worker. HEC-HMS and HEC-RAS installers are not downloaded or executed by the TSM runner. HEC-RAS desktop automation is platform-specific; use an approved Windows HEC-RAS worker unless the selected, version-matched engine adapter explicitly supports the chosen platform. Do not presume that the same RAS runner works on arbitrary Linux or hosted compute.

## Validate before execution

From the repository root:

~~~bash
node scripts/hydrology/validate-hec-run-manifest.mjs data/schemas/examples/hec-coupled-run-manifest-v2.example.json
node scripts/hydrology/validate-hec-run-manifest.mjs path/to/operator-workspace/run-manifest.json --execution
~~~

The example should pass structural validation but intentionally fail --execution. An operator manifest must pass the second command, then the runner applies file, package, executable, copy-isolation and output checks again at launch time.

On the compatible execution host, after human approval and runtime installation:

~~~bash
TSM_SOURCE_COMMIT=<full-40-character-checkout-sha> \
  node scripts/hydrology/run-hec-coupled-workflow.mjs \
  path/to/operator-workspace/run-manifest.json \
  path/to/operator-workspace
~~~

The actual run must not be launched until approval.status=APPROVED, the approval evidence is auditable, the AOI and source hashes match, every model/runtime/adapter is pinned, and the operator has confirmed the intended boundary. Do not change the DRAFT example's placeholders merely to force a green validator.

## Coupling validation rationale

The exact transfer criteria and their evidence limits are recorded in [HEC coupling validation research](HEC-COUPLING-VALIDATION-RESEARCH-2026-10-15.md). USACE's [HEC-HMS Validation Guide](https://www.hec.usace.army.mil/confluence/hmsdocs/hmsvg/latest/validation-guide) distinguishes software code validation from the separate calibration/verification required for an application watershed. Spatial flood extent comparisons also need multiple metrics and explicit treatment of observation/geolocation uncertainty; no single map-overlap score is treated as universal.

## Known limitations and release gates

- No approved pilot AOI or real qualified HEC model project was supplied for this implementation; no real HMS/RAS solver was executed here.
- Numerical calibration/independent validation, sensitivity/uncertainty analysis, professional review and agency determinations are deliberately not automated as approval.
- The default filesystem artifact backend is local. A safe shared S3/Supabase/PostgreSQL adapter requires separately tested authentication, object integrity and/or row transaction/idempotency semantics; the runner rejects the unimplemented evidence-store-adapter mode.
- A dedicated worker needs actual model software, license/usage authorization, Java/HEC DSS dependencies, compatible HEC Commander packages, sufficient CPU/RAM, a reviewed model set and a stable data mount. A web-hosted static Pages build is not a numerical solver worker.
- Validate HEC-HMS computation warnings, watershed conservation/mass balance, transfer series/interval/units and target DSS read-back fidelity, RAS plan diagnostics and HDF5 output before any separate calibration/validation or review claim.
