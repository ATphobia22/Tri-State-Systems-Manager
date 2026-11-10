#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "TSMExperienceSubsystem.generated.h"

/** Independent clocks: these values must never be silently substituted for one another. */
UENUM(BlueprintType)
enum class ETSMExperienceClock : uint8
{
    Observation, Historical, Simulation, Cinematic
};

UENUM(BlueprintType)
enum class ETSMExperienceWorkspace : uint8
{
    LivingRiverValley, EngineeringScenarioSandbox, EvidenceToCinemaStoryboard
};

USTRUCT(BlueprintType)
struct FTSMLivingRiverState
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) ETSMExperienceClock Clock = ETSMExperienceClock::Cinematic;
    UPROPERTY(BlueprintReadOnly) FString ClockUtcIso8601;
    UPROPERTY(BlueprintReadOnly) FString DataRoot;
    UPROPERTY(BlueprintReadOnly) bool bDataManifestPresent = false;
    UPROPERTY(BlueprintReadOnly) bool bDataManifestContentsVerified = false;
    UPROPERTY(BlueprintReadOnly) FString DataState = TEXT("SOURCE_UNAVAILABLE");
    UPROPERTY(BlueprintReadOnly) FString Disclaimer = TEXT("Scene visualization is not surveying, FEMA certification, or a hydraulic forecast.");
};

USTRUCT(BlueprintType)
struct FTSMScenarioScreenInput
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString ScenarioId;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString SourceManifestSha256;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString HorizontalCrs = TEXT("EPSG:2966");
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString VerticalDatum;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) double BermLengthMeters = 0.0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) double BermTopWidthMeters = 0.0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) double BermHeightMeters = 0.0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) double BermSideSlopeHorizontalToVertical = 0.0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) double RelativeInputUncertainty = 0.0;
};

USTRUCT(BlueprintType)
struct FTSMScenarioScreenResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) bool bCalculated = false;
    UPROPERTY(BlueprintReadOnly) FString Status = TEXT("INPUTS_MISSING");
    UPROPERTY(BlueprintReadOnly) double ConceptualFillVolumeCubicMeters = 0.0;
    UPROPERTY(BlueprintReadOnly) double IndicativeLowerCubicMeters = 0.0;
    UPROPERTY(BlueprintReadOnly) double IndicativeUpperCubicMeters = 0.0;
    UPROPERTY(BlueprintReadOnly) FString Equations;
    UPROPERTY(BlueprintReadOnly) FString Limitation;
};

USTRUCT(BlueprintType)
struct FTSMEvidenceStoryboardShot
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString ShotId;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Title;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString SourceId;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString SourceSha256;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString AuthorityClass;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString AcquisitionUtc;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Narrative;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bCinematicOnly = true;
};

/** Packaged-runtime experience contracts. No network calls or agency submissions. */
UCLASS()
class TSMNATIVE_API UTSMExperienceSubsystem final : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="TSM|Experiences")
    void SetWorkspace(ETSMExperienceWorkspace NewWorkspace);

    UFUNCTION(BlueprintPure, Category="TSM|Experiences")
    ETSMExperienceWorkspace GetWorkspace() const { return Workspace; }

    UFUNCTION(BlueprintCallable, Category="TSM|Experiences")
    FTSMLivingRiverState InspectLivingRiverValley(ETSMExperienceClock SelectedClock, const FString& ClockUtcIso8601) const;

    UFUNCTION(BlueprintCallable, Category="TSM|Experiences")
    FTSMScenarioScreenResult ScreenBermConcept(const FTSMScenarioScreenInput& Input) const;

    UFUNCTION(BlueprintCallable, Category="TSM|Experiences")
    bool ExportEvidenceStoryboard(const FString& StoryboardId, const TArray<FTSMEvidenceStoryboardShot>& Shots, FString& OutPath, FString& OutReason) const;

private:
    UPROPERTY() ETSMExperienceWorkspace Workspace = ETSMExperienceWorkspace::LivingRiverValley;
};
