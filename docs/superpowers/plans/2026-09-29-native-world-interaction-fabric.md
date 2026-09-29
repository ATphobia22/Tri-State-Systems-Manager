# TSM Native World Interaction Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the native Unreal world-interaction, terrain interrogation, scenario, flood, design, evidence, artifact, and cinematic foundations on top of the approved native-first TSM runtime.

**Architecture:** Keep Unreal Engine 5.8 as the canonical operator runtime. Introduce small native C++ components/subsystems with explicit contracts, while keeping scientific calculations and provenance separate from rendering. Use source-bound local data and fail closed when evidence is unavailable.

**Tech Stack:** Unreal Engine 5.8 C++, Slate/UMG, Cesium for Unreal 2.29.1, existing Archimedes/native data fabric, Node.js contract tests, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-09-29-native-world-interaction-masterclass.md

## Global Constraints

- Browser/WebView/Node/localhost runtime dependencies remain disabled.
- Network access is not required for simulation.
- Unreal Engine 5.8 is the native runtime target.
- Cesium for Unreal remains enabled for geospatial rendering.
- Authoritative and modeled evidence classes remain separate.
- Flood-frequency values must be source-bound; no synthetic frequency multipliers.
- Every engineering result must expose methodology and uncertainty.
- Local runtime data is immutable manifest-backed and SHA-256 verified.
- Conceptual design outputs must not be represented as stamped engineering documents.
- Cinematic rendering is presentation and must not alter engineering state.

## Review Focus

- Missing terrain/evidence must fail closed rather than inventing values.
- World/geographic coordinate conversion must preserve CRS and height metadata.
- Scenario timeline changes must not mutate authoritative source state.
- Flood visualization must distinguish evidence, modeled scenario, and cinematic water.
- Interactive design geometry must reject invalid dimensions and preserve provenance.

---

### Task 1: Implementation specification and native interaction contracts

**Files:**
- Create: `docs/superpowers/specs/2026-09-29-native-world-interaction-masterclass.md`
- Create: `tsm-native/config/native-world-interaction-contract.json`
- Create: `scripts/ci/validate-native-world-interaction-contract.mjs`
- Test: `scripts/ci/validate-native-world-interaction-contract.mjs`

**Interfaces:**
- Produces the canonical native interaction capability list and validation contract consumed by later tasks.

- [ ] **Step 1: Write the failing contract test** asserting required component names, native-only runtime policy, and separation of evidence classes.
- [ ] **Step 2: Run the validator and verify it fails because the contract does not exist.**
- [ ] **Step 3: Implement the JSON contract and validator.**
- [ ] **Step 4: Run the validator and verify it passes.**
- [ ] **Step 5: Commit the specification/contract gate.**

### Task 2: Native world selection and terrain interrogation

**Files:**
- Create: `tsm-native/Source/TSMNative/TSMWorldInteractionSubsystem.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMGeoSelectionComponent.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMTerrainProbeComponent.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMMeasurementSubsystem.h/.cpp`
- Modify: `tsm-native/Source/TSMNative/TSMNative.Build.cs`
- Modify: `scripts/ci/validate-native-product-contract.mjs`

**Interfaces:**
- `UTSMWorldInteractionSubsystem::SelectActor(AActor*)`
- `UTSMWorldInteractionSubsystem::ClearSelection()`
- `UTSMGeoSelectionComponent::GetSelectionMetadata()`
- `UTSMTerrainProbeComponent::ProbeWorldLocation(FVector)`
- `UTSMMeasurementSubsystem::MeasureDistance(FVector,FVector)`

- [ ] **Step 1: Add failing contract/static tests for the required native class/file surface.**
- [ ] **Step 2: Verify the tests fail because the classes do not exist.**
- [ ] **Step 3: Implement the minimal native components and data structs.**
- [ ] **Step 4: Verify static contract tests pass.**
- [ ] **Step 5: Commit.**

### Task 3: Scenario timeline and source-bound flood fabric

**Files:**
- Create: `tsm-native/Source/TSMNative/TSMScenarioTimelineSubsystem.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMFloodScenarioSubsystem.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMFloodSurfaceActor.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMFloodContourComponent.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMFloodDepthMaterial.h/.cpp`
- Create: `tsm-native/config/flood-visualization-contract.json`

**Interfaces:**
- Scenario snapshots are immutable records.
- `UTSMScenarioTimelineSubsystem::SetActiveScenario(FName)`
- `UTSMScenarioTimelineSubsystem::GetActiveScenario()`
- `UTSMFloodScenarioSubsystem::LoadScenario(FName)`
- `UTSMFloodScenarioSubsystem::EvaluateDepth(double,double)`

- [ ] **Step 1: Add failing contract tests for scenario immutability and evidence-class separation.**
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement source-bound scenario contracts and runtime scaffolding.**
- [ ] **Step 4: Verify contract tests pass.**
- [ ] **Step 5: Commit.**

### Task 4: Berm/road placement, profiles, quantities, and materials

**Files:**
- Create: `tsm-native/Source/TSMNative/TSMAlignmentActor.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMBermDesignActor.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMRoadDesignActor.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMProfileComponent.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMCutFillSubsystem.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMQuantitySubsystem.h/.cpp`
- Create: `tsm-native/config/material-model-contract.json`

**Interfaces:**
- Design objects expose validated dimensions and stationing.
- `UTSMBermDesignActor::SetDesignParameters(...)`
- `UTSMRoadDesignActor::SetAlignment(...)`
- `UTSMCutFillSubsystem::EstimateCutFill(...)`
- `UTSMQuantitySubsystem::EstimateBermVolume(...)`

- [ ] **Step 1: Add failing tests for geometry bounds and quantity calculations.**
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement validated geometry and quantity services.**
- [ ] **Step 4: Verify tests pass.**
- [ ] **Step 5: Commit.**

### Task 5: Evidence, provenance, snapshots, and source inspection

**Files:**
- Create: `tsm-native/Source/TSMNative/TSMEvidenceObject.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMProvenanceSubsystem.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMSourceInspector.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMScenarioSnapshot.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMEvidenceOverlay.h/.cpp`

**Interfaces:**
- `UTSMProvenanceSubsystem::RegisterEvidence(...)`
- `UTSMProvenanceSubsystem::BuildSnapshot(...)`
- `UTSMSourceInspector::GetSourceMetadata(...)`

- [ ] **Step 1: Add failing tests for evidence-chain completeness.**
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement provenance records and immutable snapshots.**
- [ ] **Step 4: Verify tests pass.**
- [ ] **Step 5: Commit.**

### Task 6: Design IR and artifact generation

**Files:**
- Create: `tsm-native/Source/TSMNative/TSMDesignIntermediateRepresentation.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMBlueprintGenerationSubsystem.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMUsdExportAdapter.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMBIMExportAdapter.h/.cpp`
- Modify: `tsm-native/Source/TSMNative/TSMEngineeringRuntimeSubsystem.*`

**Interfaces:**
- `FTSMDesignIR` is the canonical conceptual-design exchange object.
- `UTSMBlueprintGenerationSubsystem::GenerateBlueprintReadyPackage(...)`
- `UTSMUsdExportAdapter::ExportDesign(...)`
- `UTSMBIMExportAdapter::ExportDesign(...)`

- [ ] **Step 1: Add failing tests for Design IR serialization and artifact manifests.**
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement Design IR and generated documentation/export contracts.**
- [ ] **Step 4: Verify tests pass.**
- [ ] **Step 5: Commit.**

### Task 7: Cinematic camera, lighting, weather, Sequencer, and render provenance

**Files:**
- Create: `tsm-native/Source/TSMNative/TSMCinematicCameraSubsystem.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMCameraPresetLibrary.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMLightingPresetLibrary.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMWeatherPresetLibrary.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMSequencerIntegration.h/.cpp`
- Create: `tsm-native/Source/TSMNative/TSMMovieRenderSubsystem.h/.cpp`

- [ ] **Step 1: Add failing tests for engineering/cinematic camera separation and render provenance.**
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement preset contracts and runtime scaffolding.**
- [ ] **Step 4: Verify tests pass.**
- [ ] **Step 5: Commit.**

### Task 8: HUD integration and full native verification

**Files:**
- Modify: `tsm-native/Source/TSMNative/TSMEngineeringHUD.*`
- Modify: `tsm-native/Source/TSMNative/TSMNativeGameMode.*`
- Modify: `tsm-native/Source/TSMNative/TSMNative.Build.cs`
- Modify: `.github/workflows/tsm-native.yml`
- Modify: `tsm-console/package.json`
- Create: `tsm-native/tests/native-world-contract.test.mjs`

- [ ] **Step 1: Add failing HUD contract tests for all major panels and native-only operation.**
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Integrate world, flood, design, evidence, camera, and artifact controls into the native HUD.**
- [ ] **Step 4: Run all repository-native contract tests.**
- [ ] **Step 5: Run TypeScript/Node CI checks available in the current environment.**
- [ ] **Step 6: Run Unreal compilation/package verification when a UE5.8 runner is available; otherwise record the runner limitation without claiming packaging success.**
- [ ] **Step 7: Commit final integration.**


## Execution rulings

- **Ruling:** Group the Unreal reflection declarations and implementations into `TSMNativeWorldFabric.h/.cpp`, with thin public group headers, instead of one generated-header pair per class — this reduces UHT/build fragmentation while preserving named native interfaces; cost if wrong: future per-class ownership is less physically isolated and may require a later split after Unreal compilation proves the optimal boundary.
- **Ruling:** Use Unreal `A...` prefixes for world actors in the machine-readable contract — this matches Unreal's reflected actor type system; cost if wrong: contract consumers expecting `U...` names would need a rename.
