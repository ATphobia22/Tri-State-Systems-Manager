import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(import.meta.dirname,"../..");
test("native world fabric classes exist",()=>{
 const h=fs.readFileSync(path.join(root,"tsm-native/Source/TSMNative/TSMNativeWorldFabric.h"),"utf8");
 for(const n of ["UTSMSourceInspector","UTSMProfileComponent","UTSMMaterialLibrary","UTSMWorldInteractionSubsystem","UTSMGeoSelectionComponent","UTSMTerrainProbeComponent","UTSMMeasurementSubsystem","UTSMScenarioTimelineSubsystem","UTSMFloodScenarioSubsystem","ATSMFloodSurfaceActor","UTSMFloodContourComponent","ATSMAlignmentActor","ATSMBermDesignActor","ATSMRoadDesignActor","UTSMCutFillSubsystem","UTSMQuantitySubsystem","UTSMDesignIntermediateRepresentation","UTSMEvidenceObject","UTSMProvenanceSubsystem","UTSMScenarioSnapshot","UTSMEvidenceOverlay","UTSMBlueprintGenerationSubsystem","UTSMUsdExportAdapter","UTSMBIMExportAdapter","UTSMCinematicCameraSubsystem","UTSMCameraPresetLibrary","UTSMLightingPresetLibrary","UTSMWeatherPresetLibrary","UTSMSequencerIntegration","UTSMMovieRenderSubsystem","UTSMFloodDepthMaterial"]) assert.ok(h.includes(n),n);
});
test("native contract remains offline and evidence-bound",()=>{
 const c=JSON.parse(fs.readFileSync(path.join(root,"tsm-native/config/native-world-interaction-contract.json"),"utf8"));
 assert.equal(c.runtime.networkRequiredForSimulation,false);
 assert.equal(c.flood.syntheticFrequencyMultipliersAllowed,false);
 assert.equal(c.flood.missingEvidencePolicy,"resilient");
});

test("native World-space distances convert Unreal centimeters into meters", () => {
 const cpp=fs.readFileSync(path.join(root,"tsm-native/Source/TSMNative/TSMNativeWorldFabric.cpp"),"utf8");
 assert.match(cpp,/TSM_UNREAL_CM_TO_METERS = 0\.01/);
 assert.match(cpp,/R\.ElevationMeters=H\.ImpactPoint\.Z\*TSM_UNREAL_CM_TO_METERS/);
 assert.match(cpp,/R\.DistanceMeters=D\.Size\(\)\*TSM_UNREAL_CM_TO_METERS/);
 assert.match(cpp,/R\.HorizontalDistanceMeters=FVector\(D\.X,D\.Y,0\)\.Size\(\)\*TSM_UNREAL_CM_TO_METERS/);
 assert.match(cpp,/R\.ElevationDifferenceMeters=D\.Z\*TSM_UNREAL_CM_TO_METERS/);
 assert.match(cpp,/R\.GradePercent=R\.HorizontalDistanceMeters>KINDA_SMALL_NUMBER\?R\.ElevationDifferenceMeters\/R\.HorizontalDistanceMeters\*100\.0/);
 assert.match(cpp,/FVector::Distance\(AlignmentPoints\[I-1\],AlignmentPoints\[I\]\)\*TSM_UNREAL_CM_TO_METERS/);
});
