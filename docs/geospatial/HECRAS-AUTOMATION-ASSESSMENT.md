# HEC-RAS automation options — vetted assessment (2026-09-30)

Assessment of the "modern HEC-RAS automation" claims circulated 2026-09-30.
Verified against PyPI, the ras-commander GitHub repo, and official USACE pages.

## What is real

- **ras-commander** is real and actively maintained: PyPI `ras-commander`
  v0.103.0, author William M. Katzenmeyer, P.E., C.F.M.,
  https://github.com/gpt-cmdr/ras-commander.
  Open-source Python library for automating HEC-RAS 6.x: HDF5 result parsing
  (h5py/numpy/pandas), COM-based compute control on Windows, parallel plans,
  terrain-mod writers, and its own Linux execution path via Docker/Wine.
- **HECRASController (COM)** is real: ships with desktop HEC-RAS on Windows
  (`ShowRas`, `Project_Open`, `Compute_CurrentPlan`, `Output_NodeOutput`).
  Windows-only, legacy.
- **HEC-RAS 2025 is real**: USACE confirms a from-scratch rewrite
  (https://www.hec.usace.army.mil/software/hec-ras/2025/), Beta since
  April 2026, official release targeted Winter 2026. Focus is UI rewrite,
  new meshing, and self-contained distribution.

## What did not check out

- The circulated Python snippet does **not** match ras-commander's documented
  API. Real usage is `init_ras_project(path, "6.5")` then `ras.plan_df` /
  `ras.flow_df`; there is no documented `RasPrj("path/to.prj")` constructor
  with `plan.compute()` / `results.get_max_wsel()`.
- The h5py path `Geometry/2D Flow Areas/Cell Info/WSEL` is not a real
  results path; 2D results live under `Results/Unsteady/Output/...` in the
  plan HDF.
- "Rewritten from scratch in C#.NET" / "native public API" /
  "natively compiles for Linux" are **not** stated on the official USACE
  pages found. USACE's portability claim is about self-contained
  distribution. ras-commander still needs Windows (or Wine) for geometry
  preprocessing — evidence there is no official USACE Linux-native engine.

## What this means for TSM

- ras-commander is the vetted path **if/when** TSM automates real HEC-RAS
  runs on a Windows machine. It is not integrated now: TSM has no HEC-RAS
  model yet, and the production path is Linux/ARM.
- HEC-RAS remains evidence-gated: no model outputs are produced, quoted, or
  committed without a real executed run and its provenance.
- Do not copy the circulated snippet; use the library's documented API.
