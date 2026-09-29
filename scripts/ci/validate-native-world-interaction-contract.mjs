#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const contractPath = path.join(root, "tsm-native/config/native-world-interaction-contract.json");
const failures = [];

if (!fs.existsSync(contractPath)) {
  failures.push("Native world interaction contract is missing.");
} else {
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  if (contract.schemaVersion !== 1) failures.push("World interaction contract schemaVersion must be 1.");
  if (contract.runtime?.engine !== "Unreal Engine 5.8") failures.push("Runtime engine must be Unreal Engine 5.8.");
  if (contract.runtime?.browserRuntime !== false) failures.push("Browser runtime must be disabled.");
  if (contract.runtime?.webViewRuntime !== false) failures.push("WebView runtime must be disabled.");
  if (contract.runtime?.nodeRuntime !== false) failures.push("Node runtime must be disabled.");
  if (contract.runtime?.localhostRuntime !== false) failures.push("Localhost runtime must be disabled.");
  if (contract.runtime?.networkRequiredForSimulation !== false) failures.push("Simulation must not require network access.");

  const requiredComponents = [
    "UTSMWorldInteractionSubsystem",
    "UTSMGeoSelectionComponent",
    "UTSMTerrainProbeComponent",
    "UTSMMeasurementSubsystem",
    "UTSMScenarioTimelineSubsystem",
    "UTSMFloodScenarioSubsystem",
    "UTSMFloodSurfaceActor",
    "UTSMFloodContourComponent",
    "UTSMAlignmentActor",
    "UTSMBermDesignActor",
    "UTSMRoadDesignActor",
    "UTSMCutFillSubsystem",
    "UTSMQuantitySubsystem",
    "UTSMEvidenceObject",
    "UTSMProvenanceSubsystem",
    "UTSMSourceInspector",
    "UTSMScenarioSnapshot",
    "UTSMEvidenceOverlay",
    "UTSMDesignIntermediateRepresentation",
    "UTSMBlueprintGenerationSubsystem",
    "UTSMUsdExportAdapter",
    "UTSMBIMExportAdapter",
    "UTSMCinematicCameraSubsystem",
    "UTSMCameraPresetLibrary",
    "UTSMLightingPresetLibrary",
    "UTSMWeatherPresetLibrary",
    "UTSMSequencerIntegration",
    "UTSMMovieRenderSubsystem"
  ];

  for (const component of requiredComponents) {
    if (!contract.nativeComponents?.includes(component)) {
      failures.push(`Required native component missing from contract: ${component}`);
    }
  }

  if (contract.flood?.syntheticFrequencyMultipliersAllowed !== false) {
    failures.push("Synthetic flood-frequency multipliers must be disabled.");
  }
  if (contract.flood?.missingEvidencePolicy !== "fail-closed") {
    failures.push("Missing flood evidence must fail closed.");
  }

  const evidenceClasses = new Set(contract.evidence?.classes ?? []);
  for (const required of ["observed", "authoritative-regulatory", "modeled-engineering", "historical-reconstruction", "screening-estimate", "cinematic-presentation"]) {
    if (!evidenceClasses.has(required)) failures.push(`Evidence class missing: ${required}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `ERROR: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Native world interaction contract validation passed.");
