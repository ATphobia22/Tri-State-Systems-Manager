# Native vNext: Living River Valley, Engineering Scenario Sandbox, Evidence-to-Cinema

## Scope delivered by this change

The packaged Unreal runtime now has three explicit HUD navigation actions wired to
a `UGameInstanceSubsystem` (`UTSMExperienceSubsystem`) with Blueprint-callable
contracts. This is a **functional first vertical slice**, not a complete cinematic
production application. No browser, Node server, WebView or new GIS runtime is added.

### 1. Living River Valley

`InspectLivingRiverValley` reports whether the packaged
`Content/TSMData/data-manifest.json` exists and the clock domain selected by
the operator. **Manifest existence is not a verified snapshot.** The
`bDataManifestContentsVerified` flag explicitly stays false until the existing
native data-manifest verifier and a staged source-evidence validation workflow are
connected and independently exercised.

The existing Cesium/World Partition streaming, TSM GIS providers and selection
subsystems remain authoritative implementation points. This change does **not**
claim it loaded full Posey County buildings, rendered terrain, or verified gauge
observations. Source data cannot be automatically borrowed from cinematic scene
coordinates.

### 2. Engineering Scenario Sandbox

`ScreenBermConcept` accepts SI dimensions, a claimed source-manifest SHA-256,
horizontal CRS, and a nonempty vertical datum. It rejects missing/NaN/negative or
excessively large inputs, and computes the **prismatic trapezoidal** berm envelope:

- Cross-section area: `A = H(W + zH)` square meters, for side slope `z` H:V
  on **both** sides, top width `W` meters and height `H` meters.
- Geometric volume: `V = A L` cubic meters, with constant cross-section and
  centerline length `L` meters.
- Indicative percentage band: `V(1-r)` to `V(1+r)`, where `r` is an explicitly
  entered display percentage; **not** a confidence interval, error propagation
  or surveyed uncertainty.

The scenario **is not terrain-differenced** and has no cut, compaction,
settlement, slope stability, seepage, WSE, storage, or hydraulic performance
calculations. The manifest hash is **format-validated only**, not linked to
verified on-disk source bytes by this method. Input metadata must be staged by
human-reviewed workflows before claims can reference it. Default engineering
parameters are NOT treated as site observations.

### 3. Evidence-to-Cinema Storyboard

`ExportEvidenceStoryboard` saves an additive, bounded JSON shot manifest in
`Saved/TSM/Storyboards`. It refuses unsafe/duplicate IDs, excessive counts,
missing provenance for evidence-backed shots, and overwrites. A purely artistic
shot is explicitly marked `cinematicOnly=true`. Every shot includes a
`sourceContentVerifiedByThisOperation=false` and `agencyApproved=false`
marker. The JSON metadata is not an encoded video and no source files are
modified. To render, a separate reviewed Sequencer/Movie Render pipeline must
bind assets, run on authorized UE hardware and prove its render outputs.

## Verify the actual native runtime (distinct gates)

1. Run `node --test scripts/native/three-experiences-source-contract.test.mjs`.
2. Use the authorized Win64 UE5.8 runner and pin the **exact immutable main
   SHA** after merge. Verify UE_ROOT, Cesium/SQLite/MSVC and installed plugins.
3. Execute the existing `scripts/native/Build-TSMNativeWindows.ps1` and
   `.github/workflows/tsm-native.yml` Shipping workflow. Keep full
   BuildCookRun/AutomationTool logs and generated content hashes.
4. Confirm Authenticode signature on both `TSMNative.exe` and the installer,
   with the authorized signing certificate; inspect `TSMData` per-file hashes.
5. On a disposable clean Windows 11 x64 device, **physically disable networking**
   and run `scripts/native/Test-OfflineWindows11Shipping.ps1`. Record genuine
   headed screenshots and interactions for all three HUD actions, camera,
   terrain, tiles, source-unavailable overlays and export. Record hardware,
   FPS/VRAM, packaged-executable hash and logs.
6. Do not mark menus, rendering, terrain, 23,082 buildings, regulatory inputs,
   offline package or agency certification verified without that separate
   evidence. The workflow's source-contract gate is not a substitute.

## Next vertical-slice features

- Native file-by-file TSMData verification and UI provenance inspector.
- Interactive drawing and local terrain difference for cut/fill; scenario versioning.
- Local gauge and historical timeline adapters with acquisition/freshness labels.
- Unreal camera/lighting Sequencer authored shots linked to exported evidence.
- Per-object metadata, scene telemetry and guided public explanations.
