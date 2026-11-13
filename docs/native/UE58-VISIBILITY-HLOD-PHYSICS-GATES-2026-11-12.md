# Native visibility, HLOD, physics and release gates (2026-11-12)

## What is implemented

- `TSMBidirectionalSurfacePhysics.h`: deterministic two-cell, **bidirectional** volume transfer with finite-value checks, donor-volume clamping and mass conservation. The `UTSMEngineeringRuntimeSubsystem::ComputeTwoWaySurfaceExchange` Blueprint-callable wrapper returns an explicit validity bit and both post-step volumes. This is an **informational numerical kernel**, not a shallow-water PDE solver, calibrated diffusion-wave model, or HEC-RAS replacement. It requires a verified shared vertical datum and SI inputs.
- `scripts/geospatial/hlod-quadtree-config.json`: HLOD ENU/ECEF spatial partition controls, bounded OBB padding, a **diagnostic** screen-space-error target, and explicit authority, Draco, Nanite and H3 policy. `build-hlod-tileset.py --config ...` uses the same limits. Empty HLOD parent nodes do not fabricate simplified mesh accuracy.
- `scripts/native/Audit-UE58Toolchain.ps1`: read-only local toolchain/engine audit; it checks VS2022 MSVC, vcvars64, CMake, Ninja, Inno Setup ISCC, Windows SDK SignTool, Git, Node, UE_ROOT, and exact pinned Cesium version. It does **not** install applications or register the laptop runner.
- `.github/workflows/tsm-native.yml`: Windows packaging step now reads the **installed** Cesium `.uplugin` version, not only the repository's desired version.
- `.github/workflows/native-physics-hlod.yml`: portable C++ compilation/execution and synthetic quadtree regression tests on PRs. These do **not** substitute for Unreal Engine compilation.

## Algorithm selection and constraints

**Camera cone / frustum**: apply view-projection frustum plane tests before expensive tileset refinement. Use OBBs in the correct ECEF/ENU coordinate frame; clip against near/far planes, and account for viewport/FOV. Camera altitude alone does not determine visibility because terrain occlusion and camera direction matter.

**Screen-space error** (diagnostic perspective approximation):

`SSE_px = geometricError_m * viewportHeight_px / (2 * distance_m * tan(verticalFOV_rad/2))`

Use nearest distance to the bounding volume rather than just the center where appropriate. Screen-space error is a rendering budget, **not a metric of survey accuracy**. For a 60° vertical FOV and 1080px viewport, a 10m geometric error at 1000m distance is approximately 9.35px. A 16px target is a starting budget, not a proven optimal performance setting. Adapt it to frame-time, GPU/VRAM, latency and measured image quality; clamp it to a governed interval and avoid using it to change source accuracy.

**Draco / Nanite / Lumen**: GLB `KHR_draco_mesh_compression` is a transport/asset compression format; it is not equivalent to Unreal Nanite's virtualized mesh representation. Decode/import mesh assets through an actual Unreal build pipeline and inspect Nanite eligibility, mesh integrity and scene material compatibility. Lumen requires an actual supported render path, hardware and headed evidence. The presence of `r.Nanite.ProjectEnabled=True` in DefaultEngine.ini alone proves none of this.

**H3**: use H3 cell indexes for observation aggregation, caching, evidence lookup and coarser-resolution rollups. H3 logical parent/child relations are exact, while polygon geometry boundaries are not an exact tessellating quadtree. Never replace ECEF/ENU OBB hierarchy with H3 indices. For polygon coverage, H3's centroid containment rule must be accounted for when evaluating parcel overlap. Avoid aggregating distinct observations across time windows or incompatible units/datums.

**Adaptive Grover algorithm**: quantum Grover phase inversion and amplitude amplification require an actual quantum circuit/oracle. A CPU/GPU spatial search loop should instead use bounded priority queues, BVH/quadtrees, frustum culling, SSE refinement and measured latency. Calling this a Grover implementation without a quantum oracle would be misleading. No quantum simulation or claimed speedup is included.

**Evidence Time Machine / Uncertainty Lens / community evidence passport**: already implemented in `scripts/public_interest/evidence_kit.py`, `packages/geo/src/public-interest/` and `docs/public-interest/EVIDENCE-TIME-MACHINE-PASSPORT-2026-11-11.md`. Preserve their explicit source-hash, datum, time and missing-data boundaries. No second competing evidence store is introduced.

## Posey building accounting

Treat **23,082 source footprints/OBJECTIDs**, **20,517 height-verified LOD1 candidates**, and **23,082 final validated GLB/LOD2–4 meshes** as *three distinct gates*. Source identity matching, if independently established, is not equivalent to successful height/mesh reconstruction. Missing-height buildings remain 2D with `unknown-height`; do not synthesize roof pitches or facades. The 3D Tiles validator must be run on the actual published artifacts with `--strict-hlod` and `--require-draco`, and a source-to-mesh manifest must reconcile identifiers and hashes.

## BuildCookRun / Windows laptop setup

The existing `.github/workflows/tsm-native.yml` has an opt-in Windows Shipping job using `runs-on: [self-hosted, windows, x64, ue5]`, immutable checkout, UE 5.8, Cesium 2.29.1, manifest-backed TSMData staging, `Build-TSMNativeWindows.ps1`, BuildCookRun logs, Authenticode verification, Inno Setup and artifact attestation. It intentionally requires an authorized self-hosted runner and actual signing credentials.

1. On the Windows laptop install Visual Studio 2022 Community with Desktop development with C++ and the MSVC/Windows SDK components; install CMake, Ninja, Inno Setup 7 and GitHub Actions runner as needed.
2. Install **exactly Cesium for Unreal 2.29.1** under `UE_ROOT/Engine/Plugins/Marketplace/CesiumForUnreal`, unless a separate reviewed migration updates every pinned contract. Upstream Cesium 2.31.0 has UE5.8 artifacts, but is not the current repo pin.
3. In repository Settings → Actions → Runners, create a Windows self-hosted runner with `windows`, `x64`, `ue5` labels. Follow GitHub's generated registration commands **on that trusted laptop**; do not paste runner registration tokens into chat.
4. Set the repository variable `UE_ROOT` and required TSMData paths and signing variables/secrets. Run `pwsh -File scripts/native/Audit-UE58Toolchain.ps1` and the existing `Invoke-Windows11RunnerPreflight.ps1`.
5. Trigger `TSM Native` with `package_windows=true` at the reviewed immutable main SHA. Preserve full logs, packaged binary hashes, signer identity, screenshots and a network-disabled clean-host startup test. A CI green check alone does not certify these outcomes.

**Status:** Code authored on a review branch. Native Shipping compilation, signed installer, clean-host startup, actual LoD/3D Tiles visuals, independent building reconciliation and datum validation remain **not evidenced** until runner output is inspected. Human Authority Final.
