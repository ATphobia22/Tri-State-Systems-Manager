#include "TSMExperienceSubsystem.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FTSMNativeExperienceBermScreenTest,
    "TSM.Experiences.ScenarioSandbox.BermGeometry",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FTSMNativeExperienceBermScreenTest::RunTest(const FString& Parameters)
{
    UTSMExperienceSubsystem* Experience = NewObject<UTSMExperienceSubsystem>();
    FTSMScenarioScreenInput Input;
    Input.ScenarioId = TEXT("test-berm");
    Input.SourceManifestSha256 = FString::ChrN(64, TEXT('a'));
    Input.HorizontalCrs = TEXT("EPSG:2966");
    Input.VerticalDatum = TEXT("NAVD88");
    Input.BermLengthMeters = 100.0;
    Input.BermTopWidthMeters = 4.0;
    Input.BermHeightMeters = 2.0;
    Input.BermSideSlopeHorizontalToVertical = 3.0;
    FTSMScenarioScreenResult Output = Experience->ScreenBermConcept(Input);
    TestTrue(TEXT("Valid source-labeled conceptual inputs"), Output.bCalculated);
    TestEqual(TEXT("Trapezoidal berm volume in SI m3"), Output.ConceptualFillVolumeCubicMeters, 2000.0);
    TestEqual(TEXT("No confidence interval inferred with zero display fraction"), Output.IndicativeLowerCubicMeters, 2000.0);

    Input.SourceManifestSha256 = TEXT("unverified");
    Output = Experience->ScreenBermConcept(Input);
    TestFalse(TEXT("Missing SHA-256 is rejected"), Output.bCalculated);
    TestEqual(TEXT("Missing provenance status"), Output.Status, FString(TEXT("EVIDENCE_METADATA_REQUIRED")));

    Input.SourceManifestSha256 = FString::ChrN(64, TEXT('a'));
    Input.BermHeightMeters = -1.0;
    Output = Experience->ScreenBermConcept(Input);
    TestFalse(TEXT("Negative geometry rejected"), Output.bCalculated);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FTSMNativeExperienceStoryboardsTest,
    "TSM.Experiences.Storyboard.DisclosureAndClock",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FTSMNativeExperienceStoryboardsTest::RunTest(const FString& Parameters)
{
    UTSMExperienceSubsystem* Experience = NewObject<UTSMExperienceSubsystem>();
    const FTSMLivingRiverState InvalidClock = Experience->InspectLivingRiverValley(
        ETSMExperienceClock::Observation, TEXT("tomorrow"));
    TestFalse(TEXT("Unparseable observation timestamp"), InvalidClock.bClockTimestampValid);
    TestEqual(TEXT("No guessed timestamp"), InvalidClock.DataState, FString(TEXT("INVALID_UTC_SCENE_CLOCK")));

    FString Path;
    FString Reason;
    const TArray<FTSMEvidenceStoryboardShot> NoShots;
    TestFalse(TEXT("Empty storyboards may not be exported"),
        Experience->ExportEvidenceStoryboard(TEXT("test-empty"), NoShots, Path, Reason));

    FTSMEvidenceStoryboardShot Unsourced;
    Unsourced.ShotId = TEXT("shot-a");
    Unsourced.Title = TEXT("Unverified observation");
    Unsourced.bCinematicOnly = false;
    TArray<FTSMEvidenceStoryboardShot> Shots;
    Shots.Add(Unsourced);
    TestFalse(TEXT("No source-less evidence-backed shot"),
        Experience->ExportEvidenceStoryboard(TEXT("test-no-source"), Shots, Path, Reason));
    Shots[0].bCinematicOnly = true;
    Shots[0].SourceId = TEXT("unverified-observation");
    TestFalse(TEXT("Cinematic-only shot cannot impersonate source-backed material"),
        Experience->ExportEvidenceStoryboard(TEXT("test-artistic-source"), Shots, Path, Reason));
    return true;
}
#endif
