#include "TSMExperienceSubsystem.h"

#include "Dom/JsonObject.h"
#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

namespace
{
bool IsSha256(const FString& Hash)
{
    if (Hash.Len() != 64) return false;
    for (const TCHAR Ch : Hash)
    {
        if (!((Ch >= TEXT('0') && Ch <= TEXT('9'))
            || (Ch >= TEXT('a') && Ch <= TEXT('f'))
            || (Ch >= TEXT('A') && Ch <= TEXT('F')))) return false;
    }
    return true;
}

bool IsSafeId(const FString& Id)
{
    if (Id.IsEmpty() || Id.Len() > 64) return false;
    for (const TCHAR Ch : Id)
    {
        if (!((Ch >= TEXT('a') && Ch <= TEXT('z'))
            || (Ch >= TEXT('A') && Ch <= TEXT('Z'))
            || (Ch >= TEXT('0') && Ch <= TEXT('9'))
            || Ch == TEXT('-') || Ch == TEXT('_'))) return false;
    }
    return true;
}

bool IsValidNonnegative(const double Number)
{
    return FMath::IsFinite(Number) && Number >= 0.0;
}
}

void UTSMExperienceSubsystem::SetWorkspace(ETSMExperienceWorkspace NewWorkspace)
{
    Workspace = NewWorkspace;
}

FTSMLivingRiverState UTSMExperienceSubsystem::InspectLivingRiverValley(
    const ETSMExperienceClock SelectedClock,
    const FString& ClockUtcIso8601) const
{
    FTSMLivingRiverState State;
    State.Clock = SelectedClock;
    State.ClockUtcIso8601 = ClockUtcIso8601;
    FDateTime ParsedUtc;
    State.bClockTimestampValid = ClockUtcIso8601.EndsWith(TEXT("Z"))
        && FDateTime::ParseIso8601(*ClockUtcIso8601, ParsedUtc);
    // This is the packaged snapshot location; it must not trigger HTTP requests.
    State.DataRoot = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("TSMData"));
    const FString Manifest = FPaths::Combine(State.DataRoot, TEXT("data-manifest.json"));
    State.bDataManifestPresent = IFileManager::Get().FileExists(*Manifest);
    // Mere existence is not verification. Native release gate checks each file
    // against its provenance manifest independently before the scene is trusted.
    State.bDataManifestContentsVerified = false;
    State.DataState = !State.bClockTimestampValid
        ? TEXT("INVALID_UTC_SCENE_CLOCK")
        : (State.bDataManifestPresent
            ? TEXT("MANIFEST_PRESENT_CONTENTS_UNVERIFIED")
            : TEXT("SOURCE_UNAVAILABLE"));
    return State;
}

FTSMScenarioScreenResult UTSMExperienceSubsystem::ScreenBermConcept(
    const FTSMScenarioScreenInput& Input) const
{
    FTSMScenarioScreenResult Result;
    Result.Equations = TEXT("A=H*(W+Z*H) [m2], V=A*L [m3], Z=horizontal:vertical slope per side");
    Result.Limitation = TEXT(
        "Illustrative constant-section fill geometry ONLY. Not terrain-differenced cut/fill, "
        "hydraulic performance, flood protection, structural safety, model calibration, "
        "agency certification, or an estimate of actual construction quantities. "
        "No input measurement uncertainty is inferred.");
    if (!IsSafeId(Input.ScenarioId) || !IsSha256(Input.SourceManifestSha256)
        || Input.HorizontalCrs.IsEmpty() || Input.VerticalDatum.IsEmpty())
    {
        Result.Status = TEXT("EVIDENCE_METADATA_REQUIRED");
        return Result;
    }

    if (!IsValidNonnegative(Input.BermLengthMeters)
        || !IsValidNonnegative(Input.BermTopWidthMeters)
        || !IsValidNonnegative(Input.BermHeightMeters)
        || !IsValidNonnegative(Input.BermSideSlopeHorizontalToVertical)
        || !IsValidNonnegative(Input.RelativeInputUncertainty)
        || Input.RelativeInputUncertainty > 1.0)
    {
        Result.Status = TEXT("INVALID_SI_INPUTS");
        return Result;
    }
    // Deliberately bound the conceptual envelope and prevent non-finite overflow.
    if (Input.BermLengthMeters > 100000.0
        || Input.BermTopWidthMeters > 10000.0
        || Input.BermHeightMeters > 1000.0
        || Input.BermSideSlopeHorizontalToVertical > 100.0)
    {
        Result.Status = TEXT("SCENARIO_ENVELOPE_EXCEEDED");
        return Result;
    }

    const double Area = Input.BermHeightMeters
        * (Input.BermTopWidthMeters
           + Input.BermSideSlopeHorizontalToVertical * Input.BermHeightMeters);
    const double Volume = Area * Input.BermLengthMeters;
    if (!FMath::IsFinite(Volume))
    {
        Result.Status = TEXT("NONFINITE_RESULT");
        return Result;
    }

    Result.bCalculated = true;
    Result.Status = TEXT("CONCEPTUAL_GEOMETRY_ONLY");
    Result.ConceptualFillVolumeCubicMeters = Volume;
    // These are ±percentage display bands, NOT propagated measurement
    // uncertainty. Never call them confidence intervals or error bounds.
    const double Fraction = Input.RelativeInputUncertainty;
    Result.IndicativeLowerCubicMeters = Volume * (1.0 - Fraction);
    Result.IndicativeUpperCubicMeters = Volume * (1.0 + Fraction);
    return Result;
}

bool UTSMExperienceSubsystem::ExportEvidenceStoryboard(
    const FString& StoryboardId,
    const TArray<FTSMEvidenceStoryboardShot>& Shots,
    FString& OutPath,
    FString& OutReason) const
{
    OutPath.Empty();
    if (!IsSafeId(StoryboardId) || Shots.IsEmpty() || Shots.Num() > 64)
    {
        OutReason = TEXT("Storyboard needs safe ID and 1..64 reviewed shots");
        return false;
    }

    TSet<FString> Seen;
    TArray<TSharedPtr<FJsonValue>> ShotValues;
    for (const FTSMEvidenceStoryboardShot& Shot : Shots)
    {
        if (!IsSafeId(Shot.ShotId) || Seen.Contains(Shot.ShotId)
            || Shot.Title.IsEmpty() || Shot.Title.Len() > 180
            || Shot.Narrative.Len() > 2000)
        {
            OutReason = TEXT("Invalid, duplicate, or excessive storyboard shot");
            return false;
        }
        Seen.Add(Shot.ShotId);
        if (Shot.bCinematicOnly &&
            (!Shot.SourceId.IsEmpty() || !Shot.SourceSha256.IsEmpty() || !Shot.AuthorityClass.IsEmpty()))
        {
            OutReason = TEXT("Cinematic-only shots cannot impersonate observed source material");
            return false;
        }
        if (!Shot.bCinematicOnly &&
            (Shot.SourceId.IsEmpty() || !IsSha256(Shot.SourceSha256)
                || Shot.AuthorityClass.IsEmpty() || Shot.AcquisitionUtc.IsEmpty()))
        {
            OutReason = TEXT("Evidence-backed shots need source, checksum, classification and acquisition date");
            return false;
        }

        TSharedRef<FJsonObject> Row = MakeShared<FJsonObject>();
        Row->SetStringField(TEXT("shotId"), Shot.ShotId);
        Row->SetStringField(TEXT("title"), Shot.Title);
        Row->SetStringField(TEXT("narrative"), Shot.Narrative);
        Row->SetStringField(TEXT("sourceId"), Shot.SourceId);
        Row->SetStringField(TEXT("sourceSha256"), Shot.SourceSha256);
        Row->SetStringField(TEXT("authorityClass"), Shot.AuthorityClass);
        Row->SetStringField(TEXT("acquisitionUtc"), Shot.AcquisitionUtc);
        Row->SetBoolField(TEXT("cinematicOnly"), Shot.bCinematicOnly);
        Row->SetBoolField(TEXT("sourceContentVerifiedByThisOperation"), false);
        Row->SetBoolField(TEXT("agencyApproved"), false);
        ShotValues.Add(MakeShared<FJsonValueObject>(Row));
    }

    TSharedRef<FJsonObject> Report = MakeShared<FJsonObject>();
    Report->SetStringField(TEXT("schema"), TEXT("tsm.native.evidence-storyboard.v1"));
    Report->SetStringField(TEXT("storyboardId"), StoryboardId);
    Report->SetStringField(TEXT("state"), TEXT("REVIEW_REQUIRED_NOT_RENDERED"));
    Report->SetBoolField(TEXT("regulatoryDetermination"), false);
    Report->SetBoolField(TEXT("modelOutputAltered"), false);
    Report->SetArrayField(TEXT("shots"), ShotValues);
    Report->SetStringField(TEXT("notice"), TEXT(
        "A shot manifest is a narrative plan, not a movie or verified data package. "
        "Cinematic effects must be visibly distinguished from observations and models."));

    FString Output;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Output);
    if (!FJsonSerializer::Serialize(Report, Writer))
    {
        OutReason = TEXT("JSON serialization failed");
        return false;
    }

    const FString Root = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("TSM"), TEXT("Storyboards"));
    IFileManager::Get().MakeDirectory(*Root, true);
    const FString Target = FPaths::Combine(Root, StoryboardId + TEXT(".json"));
    // Never replace previously reviewed storyboard evidence silently.
    if (IFileManager::Get().FileExists(*Target)
        || !FFileHelper::SaveStringToFile(Output, *Target, FFileHelper::EEncodingOptions::ForceUTF8))
    {
        OutReason = TEXT("Storyboard already exists, or storage write failed");
        return false;
    }

    OutPath = Target;
    OutReason = TEXT("Manifest created; evidence verification and render pending");
    return true;
}
