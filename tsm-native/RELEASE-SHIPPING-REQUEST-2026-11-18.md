# Windows UE5.8 Shipping evidence request — 2026-11-18

**Purpose:** Request one controlled, independently inspectable Windows Shipping packaging run from the exact reviewed `main` commit. This file is **not** a build-success report. It is an operator audit receipt and must not be used to mark the UE5.8 release verified.

## Trigger / reproducibility

The existing [TSM Native workflow](../.github/workflows/tsm-native.yml) supports `workflow_dispatch` with `package_windows: true` and also the explicit one-shot `main` push marker `[TSM-UE-PACKAGE]`. This file is a permitted native-path change to request that existing, intentionally gated action.

After code-review and all PR-head checks pass, **squash-merge this request with the literal marker in the merge commit title**, exactly once. The workflow must check out `github.sha`; a normal PR run is not a substitute because it skips `package-windows`.

The request must follow the merged public GeoTruth, Cesium cinema, and Unreal browser-crosswalk changes. Do not overwrite or bypass expected source hashes, security tests, model evidence, or signing requirements just to achieve a green status.

## Required native runner and data prerequisites

- Windows x64 self-hosted runner with labels `self-hosted`, `windows`, `x64`, `ue5`.
- A pinned UE5.8 `UE_ROOT` and matching MSVC/Windows SDK; Cesium for Unreal **2.29.1** as required by the existing workflow, with installed plugin metadata inspected rather than assumed.
- Verified `TSM_NATIVE_DATA_ROOT` including `data-manifest.json` and `regional-release-snapshot.json`; no fabricated or silently skipped cross-state data. Optional private Drive restoration may run only when configured.
- Pinned `TSM_SPATIALITE_DLL` and reviewed release signing/timestamp configuration. No secret values or private geographic data belong in this file or public CI logs.

## Evidence that must be retained or marked unavailable

| Workflow output | Acceptance purpose |
| --- | --- |
| `tsm-cross-state-release-preflight` | County scope and source manifests, with unresolved gaps explicit |
| `tsm-ue-windows-buildcookrun-log` | Full UE BuildCookRun transcript, including nonzero errors and source commit |
| `tsm-ue-windows-shipping-static-evidence` | Static archive inspection tied to exact source SHA; **not** offline startup proof |
| `tsm-native-signed-artifacts-evidence` | Binary/installer signature, certificate and timestamp verification |
| `tsm-native-windows-release-manifest` | Installer and hashes bound to the build |
| `tsm-native-windows-installer` | Actual generated installer, if and only if all packaging steps succeed |

Inspect each artifact's emitted hash, workflow job status and exact SHA. Workflow `success` with packaging `skipped` is **not** release evidence. A queued run is **PENDING**, not an assumed completed build. A runner failure is **BLOCKED**, not a reason to bypass scientific/source gates.

## Post-packaging clean-room acceptance — separate independent gate

On a clean Windows 11 x64 machine disconnected from networks: install and start the built executable; verify no localhost/WebView/Node dependence, no external tile fetch, and all privileged network interactions disabled. Exercise real terrain and 3D Tiles with published manifest IDs, map and cinematic/collapsible controls, source-unavailable UI, and native `EXPORT PASSPORT JSON` action. Independently recompute the JSON/receipt SHA-256 and check exclusive-file collision behavior. Record screenshots/video, hardware/GPU/VRAM/FPS, installer SHA-256, launch/exit codes, source SHA, datum and county-coverage provenance.

**Classification boundaries:** Browser/Cypress visual fixtures are synthetic; the Tauri Windows offline-runtime job is distinct from UE5.8 Shipping; the Python passport exporter does not prove native HUD execution; neither a packaged executable nor its signature certifies surveyed structures, FEMA LOMA outcomes, flood hydraulics, or full 23,082 footprint coverage.

## Official technical guidance

- [Unreal Engine 5.8 packaging](https://dev.epicgames.com/documentation/en-us/unreal-engine/packaging-your-project): packaging invokes UAT BuildCookRun.
- [Unreal Engine 5.8 Automation Tool](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-automation-tool-overview-for-unreal-engine): unattended build/cook/test tooling.
- [GitHub Actions manual workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow): input-driven dispatch, distinct from the reviewed push-marker path.

Trace closure in [release issue #658](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/658). **Human authority final.**
