#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "TSMEngineeringRuntimeSubsystem.generated.h"

UENUM(BlueprintType)
enum class ETSMFloodScenario : uint8
{
    Current UMETA(DisplayName = "Current"),
    Design100Year UMETA(DisplayName = "100-Year"),
    Design500Year UMETA(DisplayName = "500-Year"),
    Historic1937 UMETA(DisplayName = "1937 Historic"),
    Custom UMETA(DisplayName = "Custom")
};

USTRUCT(BlueprintType)
struct FTSMEngineeringInputs
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydrology")
    double DrainageAreaAcres = 640.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydrology", meta = (ClampMin = "0.0", ClampMax = "1.0"))
    double RunoffCoefficient = 0.55;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydrology")
    double RainfallIntensityInchesPerHour = 2.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydraulics")
    double ManningRoughness = 0.035;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydraulics")
    double FlowAreaSquareMeters = 100.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydraulics")
    double WettedPerimeterMeters = 30.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydraulics")
    double ChannelSlope = 0.0005;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hydraulics")
    double DesignDischargeCubicMetersPerSecond = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scenario", meta = (ClampMin = "0.0"))
    double ScenarioDischargeMultiplier = 1.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Site")
    double ExistingGroundElevationMeters = 116.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Site")
    double WaterSurfaceElevationMeters = 117.5;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Site")
    double TargetFreeboardMeters = 0.6;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Berm/Road")
    double BermLengthMeters = 500.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Berm/Road")
    double BermTopWidthMeters = 6.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Berm/Road")
    double BermHeightMeters = 1.8;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Berm/Road")
    double BermSideSlopeHorizontalToVertical = 3.0;
};

USTRUCT(BlueprintType)
struct FTSMEngineeringResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Hydrology")
    double RationalPeakFlowCubicMetersPerSecond = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Hydraulics")
    double ManningVelocityMetersPerSecond = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Hydraulics")
    double ManningCapacityCubicMetersPerSecond = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Flood")
    double FloodDepthMeters = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Flood")
    double RequiredDesignElevationMeters = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Berm/Road")
    double BermCrossSectionAreaSquareMeters = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Berm/Road")
    double BermFillVolumeCubicMeters = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Berm/Road")
    double RequiredFreeboardMeters = 0.0;

    UPROPERTY(BlueprintReadOnly, Category = "Scenario")
    double ScenarioDischargeMultiplierApplied = 1.0;

    UPROPERTY(BlueprintReadOnly, Category = "Provenance")
    FString MethodologyVersion = TEXT("TSM-Engineering-1.1");


    UPROPERTY(BlueprintReadOnly, Category = "Provenance")
    FString UncertaintyNote = TEXT("Screening-level deterministic calculation; not a substitute for a calibrated hydraulic model or regulatory determination.");
};

UCLASS()
class TSMNATIVE_API UTSMEngineeringRuntimeSubsystem final : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "TSM|Engineering")
    FTSMEngineeringResult EvaluateScenario(
        const FTSMEngineeringInputs& Inputs,
        ETSMFloodScenario Scenario) const;

    UFUNCTION(BlueprintCallable, Category = "TSM|Engineering")
    bool ExportEngineeringReport(
        const FString& ScenarioName,
        const FTSMEngineeringInputs& Inputs,
        const FTSMEngineeringResult& Result,
        FString& OutFilePath) const;

    UFUNCTION(BlueprintPure, Category = "TSM|Engineering")
    static double ComputeRationalPeakFlow(
        double DrainageAreaAcres,
        double RunoffCoefficient,
        double RainfallIntensityInchesPerHour);

    UFUNCTION(BlueprintPure, Category = "TSM|Engineering")
    static double ComputeManningVelocity(
        double Roughness,
        double HydraulicRadiusMeters,
        double ChannelSlope);

    UFUNCTION(BlueprintPure, Category = "TSM|Engineering")
    static double ComputeManningDischarge(
        double AreaSquareMeters,
        double Roughness,
        double HydraulicRadiusMeters,
        double ChannelSlope);

    UFUNCTION(BlueprintPure, Category = "TSM|Engineering")
    static double ComputeBermVolume(
        double LengthMeters,
        double TopWidthMeters,
        double HeightMeters,
        double SideSlopeHorizontalToVertical);

private:
    static FString SanitizeScenarioName(const FString& Value);
};
