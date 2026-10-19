# Reproducible HEC-HMS → HEC-RAS run workflow (manifest v2)

## Current state

The repository now defines a resilient v2 run-manifest contract, an execution-readiness validator, a reproducible orchestration runner, a DSS-to-HEC-RAS boundary handoff adapter, local content-addressed artifact capture, and regression tests for handoff rules.

**No real coupled HEC simulation is claimed.** A candidate parcel for 13101 Bonebank Road has been identified from IGIO parcel geometry and documented with USGS elevation and FEMA/Indiana DNR flood-layer observations. A second legacy “surveyed centroid” lies approximately 6.4 km away, so the address-to-parcel/site location remains unresolved. It is not an approved hydrologic AOI: the contributing watershed/outlet, qualified source inputs, HEC model packages, installed runtimes, transfer selector, environment lock, and qualified engineering review remain unverified. See [full AOI report](AOI-REPORT-13101-BONEBANK-ROAD-2026-10-15.md). The candidate-specific manifest stays DRAFT and execution must remain blocked.

## Official product and adapter versions

As checked 2026-10-15:

- The USACE HEC-HMS download/docs pages list HEC-HMS 4.14, with its final release noted as 2026-09-28. Verify the [download page](https://www.hec.usace.army.mil/software/hec-hms/downloads.aspx) and matching [4.14 release notes](https://www.hec.usace.army.mil/confluence/hmsdocs/hmsum/4.14/release-notes/v-4-14-0-release-notes) on the execution host.
- The USACE download page lists HEC-RAS 7.0.1, released 2026-06-02; the current package is a Windows 10/11 x64 setup, with Linux compute-engine support through the packaged Windows/WSL workflow. Verify the [download page](https://www.hec.usace.army.mil/software/hec-ras/download.aspx) and [release notes](https://www.hec.usace.army.mil/confluence/rasdocs/rasrn/latest).
- The adapter pins hms-commander 0.4.0 from the exact TSM-user fork commit [1404fee5c81820764197f38923764f8c1d1b2fb7](https://github.com/ATphobia22/hms-commander/commit/1404fee5c81820764197f38923764f8c1d1b2fb7), and ras-commander 0.105.0 from [574adbc725f9436a196698970febe39d98ef30c5](https://github.com/gpt-cmdr/ras-commander/commit/574adbc725f9436a196698970febe39d98ef30c5). PyPI publishes hms-commander 0.4.0 (released 2026-10-04), but TSM intentionally installs the exact VCS reference from scripts/hydrology/requirements-hec-handoff.txt so PEP 610 direct_url.json can prove the expected source commit at runtime. A package installed from an arbitrary index artifact without matching VCS metadata fails closed. HMS Commander identifies itself as active/beta software that needs engineering oversight; package versions do not qualify a project or validate a model.
- The [coupled-forecast example notebook](https://github.com/gpt-cmdr/ras-commander/blob/main/examples/918_hms_ras_coupled_forecast.ipynb) is an integration pattern, not evidence that a TSM project has been run. The [HEC-HMS Technical Reference Manual (2023-10-18)](https://www.hec.usace.army.mil/software/hec-hms/documentation/HEC-HMS_Technical_Reference_Manual-20231018.pdf) supports scientific method review; it is not authorization to invent project parameters.

Do not stamp a software version into the manifest until the installed binary version and its version-evidence record are inspected on the actual H&H runner.

## Contracts and entry points

| Purpose | Path |
|---|---|
| Current contract (v2) | data/schemas/hec-coupled-run-manifest-v2.schema.json |
| DRAFT manifest template | data/schemas/examples/hec-coupled-run-manifest-v2.example.json |
| Fail-closed validation | scripts/hydrology/validate-hec-run-manifest.mjs |
| HEC-HMS-to-RAS handoff | scripts/hydrology/hms-ras-handoff.py |
| HEC-HMS compute wrapper | scripts/hydrology/run-hec-hms.py |
| HEC-RAS compute/verification wrapper | scripts/hydrology/run-hec-ras.py |
| Shared runtime/provenance gates | scripts/hydrology/hec_runtime_common.py |
| Installed environment fingerprint | scripts/hydrology/fingerprint-hec-environment.py |
| Wrapper regression tests | backend/tests/test_hec_solver_wrappers.py |
| Orchestration, stage receipts and artifact blobs | scripts/hydrology/run-hec-coupled-workflow.mjs |
| Node contract/runner tests | tsm-console/tests/hec-coupled-run-manifest.test.mjs |
| Python pure handoff tests | backend/tests/test_hec_hms_ras_handoff.py |

The v1 schema and its example are retained as immutable compatibility artifacts. New runs use v2. The v2 manifest pins the source Git commit, AOI/delineation hashes, source-input provenance and quality, project-package hashes, adapter and vendor-executable hashes, version evidence, exact DSS record and selected RAS boundary, interval/time zone, units/conversion method, output paths, artifact store mode, and run timeout. Unknown fields or unsupported schema keywords fail closed.

## Workflow

1. **Prepare the evidence package.** Place the approved AOI polygon, the independently reviewed watershed delineation, and each source artifact in the operator-controlled workspace. The manifest hashes must match the exact bytes. Keep all original inputs read-only. Record source URLs/acquisition time, valid time, licensing/terms, quality state, units, CRS and vertical datum. A map viewport, live station, radar image, or a public sample watershed is not an approved design basin.
2. **Pin exact model packages.** Inventory every file referenced by the HEC-HMS project, meteorologic/basin/control/run settings, DSS dependencies, and the HEC-RAS project, geometry/terrain, unsteady flow, plan and boundary condition files. Hash the full source project tree and record the installed vendor binary hash/version. Run only from a fresh run copy; the runner verifies the source copy hash before and after.
3. **Run HEC-HMS through a version-qualified command adapter.** The command must be an explicit argv array (no shell pipeline), produce the expected non-empty DSS output under that run's isolated output directory, and retain stdout/stderr. Verify the selected simulation run and inspect warnings/errors; a zero process exit code by itself is insufficient.
4. **Transfer one explicit FLOW pathname.** The adapter searches the source DSS catalog for exactly source_dss_pathname, not the first result. It checks B/C/E/F semantics, exact units from DSS metadata, time zone and interval, increasing timestamps, no missing/duplicate/irregular intervals, no non-finite or negative values, and the declared unit conversion. It writes the target DSS pathname at the declared dss_version, validates the target pathname, and uses RasUnsteady.set_boundary_dss_link to update only the declared 1D, 2D, or indexed boundary selector. It checks the staged .uNN file's target path references and emits a handoff receipt. It does not generate values or interpolate gaps.
5. **Run HEC-RAS through a version-qualified compute adapter.** The adapter must execute the explicitly selected plan using the staged boundary condition and produce the declared fresh .hdf output. TSM verifies the HDF5 signature and hashes/logs, but that is not a substitute for examining HEC-RAS computation messages, plan time coverage, mass-balance stability, units, roughness, terrain, structures, mesh, and boundary conditions.
6. **Retain the receipts.** Each source, input, model package, stdout/stderr log, handoff record, HEC-RAS output and final run receipt is copied into the filesystem content-addressed store keyed by lowercase SHA-256. An existing same-digest blob is re-hashed before reuse. The current implementation is local filesystem storage with metadata_store=run-manifest-only; it does not claim a shared cloud durability SLA or register database rows.
7. **Keep science and approval as separate gates.** The successful terminal state is COMPLETED_UNVALIDATED. A qualified engineer must inspect the model, calibrate against an evidence-qualified observation set, validate independently on separate observations, assess parameter sensitivity/uncertainty, document limitations and sign off before any engineering or regulatory use. A run receipt cannot promote approval by itself.

## Configure the runner

Copy the v2 example to a controlled run directory outside the checked-out source packages, then replace all placeholders with reviewed evidence. The manifest's source_commit must be the full SHA of the TSM checkout on the execution worker; supply the same value in TSM_SOURCE_COMMIT for a local run or GITHUB_SHA for the runner environment.

Every model-stage command is an argument array. Its first token is the absolute path to a reviewed adapter launcher (for example a pinned Python executable that invokes a local HEC installation); executable_sha256 hashes that launcher, while runtime_executable_path/runtime_executable_sha256 separately pin the actual HEC vendor binary. The command must use {{workspace}}, {{project}} and {{output}} placeholders as applicable and place expected output files underneath output_directory.

The repository now provides concrete stage adapters. After approval, use argument arrays of this shape (replace the Python path with the exact, hash-pinned interpreter on the qualified worker):

~~~json
{
  "hec_hms.command": [
    "ABSOLUTE/PATH/TO/PINNED/PYTHON",
    "{{workspace}}/scripts/hydrology/run-hec-hms.py",
    "--project", "{{project}}",
    "--output", "{{output}}",
    "--manifest", "{{manifest}}",
    "--workspace", "{{workspace}}"
  ],
  "hec_ras.command": [
    "ABSOLUTE/PATH/TO/PINNED/PYTHON",
    "{{workspace}}/scripts/hydrology/run-hec-ras.py",
    "--project", "{{project}}",
    "--output", "{{output}}",
    "--manifest", "{{manifest}}",
    "--workspace", "{{workspace}}"
  ]
}
~~~

Set `hec_hms.run_name` to the exact run in the HMS project and `hec_ras.plan_number` to the exact plan in the RAS project. Declare expected outputs relative to each stage output directory (normally under `project-copy/`). Both wrappers refuse a DRAFT manifest, verify the installed vendor executable hash and exact pinned Python-package VCS commit, compute only into a fresh project copy, and write a stage receipt. The RAS wrapper additionally requires the solver library to report verified completion. These checks do not replace independent numerical calibration, validation, or engineering review.

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

Install the source-pinned handoff packages in an isolated, reviewed H&H environment with `python -m pip install -r scripts/hydrology/requirements-hec-handoff.txt`. Before a run is eligible, generate and commit a platform-specific transitive dependency lock using a pinned resolver; include hashes for index-distributed packages and preserve the two immutable VCS source pins where the resolver cannot hash direct Git sources. Populate `python_environment.lock_uri`, `lock_workspace_path`, and `lock_sha256`. Run `python scripts/hydrology/fingerprint-hec-environment.py --workspace . --lock-file scripts/hydrology/requirements-hec-handoff.lock.txt --lock-uri <immutable-lock-uri>` on the actual Windows x64 worker and record its `python_version`, `platform`, and `installed_packages_sha256` in the manifest. The Node runner verifies the lock-file bytes and stores the lock as an artifact; both Python stage wrappers additionally verify the installed-package fingerprint before invoking a solver. The adapter verifies PEP 610 VCS commit metadata and refuses a package installed from an arbitrary PyPI release. Use the same requirements file and Python version on each worker. The adapter and each Python package version must be installed and verified on the actual worker. HEC-HMS and HEC-RAS installers are not downloaded or executed by the TSM runner. The HEC-RAS terms-and-conditions dialog must be accepted by an authorized operator before unattended execution; the wrapper does not auto-accept it. HEC-RAS desktop automation is platform-specific; use an approved Windows HEC-RAS worker unless the selected, version-matched engine adapter explicitly supports the chosen platform. Do not presume that the same RAS runner works on arbitrary Linux or hosted compute.

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

## Known limitations and release gates

- A candidate parcel is recorded, but the hydrologic watershed/outlet is not delineated or approved and no qualified HEC-HMS/HEC-RAS source model project was supplied. No real HMS/RAS solver was executed here.
- Numerical calibration/independent validation, sensitivity/uncertainty analysis, professional review and agency determinations are deliberately not automated as approval.
- The default filesystem artifact backend is local. A safe shared S3/Supabase/PostgreSQL adapter requires separately tested authentication, object integrity and/or row transaction/idempotency semantics; the runner rejects the unimplemented evidence-store-adapter mode.
- A dedicated worker needs actual model software, license/usage authorization, Java/HEC DSS dependencies, compatible HEC Commander packages, sufficient CPU/RAM, a reviewed model set and a stable data mount. A web-hosted static Pages build is not a numerical solver worker.
- Validate HEC-HMS computation warnings, watershed conservation/mass balance, transfer series/interval/units, RAS plan diagnostics and HDF5 output before any separate calibration/validation or review claim.
