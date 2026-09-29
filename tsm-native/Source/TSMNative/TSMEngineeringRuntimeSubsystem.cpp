#include "TSMEngineeringRuntimeSubsystem.h"

#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

namespace TSMEngineeringConstants
{
    constexpr double AcresToSquareMeters = 4046.8564224;
    constexpr double InchesPerHourToMetersPerSecond = 0.0254 / 3600.0;
}

double UTSMEngineeringRuntimeSubsystem::ComputeRationalPeakFlow(
    const double DrainageAreaAcres,
    const double RunoffCoefficient,
    const double RainfallIntensityInchesPerHour)
{
    const double Area = FMath::Max(0.0, DrainageAreaAcres) * TSMEngineeringConstants::AcresToSquareMeters;
    const double C = FMath::Clamp(RunoffCoefficient, 0.0, 1.0);
    const double I = FMath::Max(0.0, RainfallIntensityInchesPerHour)
        * TSMEngineeringConstants::InchesPerHourToMetersPerSecond;

    return C * I * Area;
}

double UTSMEngineeringRuntimeSubsystem::ComputeManningVelocity(
    const double Roughness,
    const double HydraulicRadiusMeters,
    const double ChannelSlope)
{
    const double N = FMath::Max(Roughness, KINDA_SMALL_NUMBER);
    const double R = FMath::Max(HydraulicRadiusMeters, 0.0);
    const double S = FMath::Max(ChannelSlope, 0.0);

    return (1.0 / N) * FMath::Pow(R, 2.0 / 3.0) * FMath::Sqrt(S);
}

double UTSMEngineeringRuntimeSubsystem::ComputeManningDischarge(
    const double AreaSquareMeters,
    const double Roughness,
    const double HydraulicRadiusMeters,
    const double ChannelSlope)
{
    return FMath::Max(0.0, AreaSquareMeters)
        * ComputeManningVelocity(Roughness, HydraulicRadiusMeters, ChannelSlope);
}

double UTSMEngineeringRuntimeSubsystem::ComputeBermVolume(
    const double LengthMeters,
    const double TopWidthMeters,
    const double HeightMeters,
    const double SideSlopeHorizontalToVertical)
{
    const double L = FMath::Max(0.0, LengthMeters);
    const double W = FMath::Max(0.0, TopWidthMeters);
    const double H = FMath::Max(0.0, HeightMeters);
    const double Z = FMath::Max(0.0, SideSlopeHorizontalToVertical);

    const double CrossSectionArea = H * (W + Z * H);
    return CrossSectionArea * L;
}

FTSMEngineeringResult UTSMEngineeringRuntimeSubsystem::EvaluateScenario(
    const FTSMEngineeringInputs& Inputs,
    const ETSMFloodScenario Scenario) const
{
    FTSMEngineeringResult Result;

    const double ScenarioMultiplier = FMath::Max(0.0, Inputs.ScenarioDischargeMultiplier);
    const double HydraulicRadius = Inputs.WettedPerimeterMeters > KINDA_SMALL_NUMBER
        ? FMath::Max(0.0, Inputs.FlowAreaSquareMeters) / Inputs.WettedPerimeterMeters
        : 0.0;

    Result.ScenarioDischargeMultiplierApplied = ScenarioMultiplier;

    Result.RationalPeakFlowCubicMetersPerSecond =
        ComputeRationalPeakFlow(
            Inputs.DrainageAreaAcres,
            Inputs.RunoffCoefficient,
            Inputs.RainfallIntensityInchesPerHour) * ScenarioMultiplier;

    Result.ManningVelocityMetersPerSecond =
        ComputeManningVelocity(
            Inputs.ManningRoughness,
            HydraulicRadius,
            Inputs.ChannelSlope);

    Result.ManningCapacityCubicMetersPerSecond =
        ComputeManningDischarge(
            Inputs.FlowAreaSquareMeters,
            Inputs.ManningRoughness,
            HydraulicRadius,
            Inputs.ChannelSlope);

    Result.FloodDepthMeters =
        FMath::Max(0.0, Inputs.WaterSurfaceElevationMeters - Inputs.ExistingGroundElevationMeters);

    Result.RequiredFreeboardMeters = FMath::Max(0.0, Inputs.TargetFreeboardMeters);
    Result.RequiredDesignElevationMeters =
        Inputs.WaterSurfaceElevationMeters + Result.RequiredFreeboardMeters;

    const double Height = FMath::Max(
        Inputs.BermHeightMeters,
        Result.RequiredDesignElevationMeters - Inputs.ExistingGroundElevationMeters);

    Result.BermCrossSectionAreaSquareMeters =
        Height * (
            FMath::Max(0.0, Inputs.BermTopWidthMeters)
            + FMath::Max(0.0, Inputs.BermSideSlopeHorizontalToVertical) * Height);

    Result.BermFillVolumeCubicMeters =
        Result.BermCrossSectionAreaSquareMeters * FMath::Max(0.0, Inputs.BermLengthMeters);

    return Result;
}

bool UTSMEngineeringRuntimeSubsystem::ExportDesignAndGrantPackage(
    const FString& ScenarioName,
    const FTSMEngineeringInputs& Inputs,
    const FTSMEngineeringResult& Result,
    FString& OutDirectory) const
{
    const FString Root = FPaths::Combine(
        FPaths::ProjectSavedDir(),
        TEXT("TSM"),
        TEXT("DesignPackages"),
        SanitizeScenarioName(ScenarioName));

    IFileManager::Get().MakeDirectory(*Root, true);
    OutDirectory = Root;

    FString ReportPath;
    if (!ExportEngineeringReport(ScenarioName, Inputs, Result, ReportPath))
    {
        return false;
    }

    const FString BlueprintPath = FPaths::Combine(Root, TEXT("blueprint-ready-design-notes.md"));
    const FString BlueprintNotes = FString::Printf(
        TEXT("# Blueprint-Ready Design Notes\n\n")
        TEXT("Scenario: %s\n\n")
        TEXT("## Geometry Parameters\n")
        TEXT("- Berm length: %.3f m\n")
        TEXT("- Berm top width: %.3f m\n")
        TEXT("- Berm height: %.3f m\n")
        TEXT("- Side slope H:V: %.3f\n")
        TEXT("- Required design elevation: %.3f m\n\n")
        TEXT("## Engineering Controls\n")
        TEXT("The geometry is a screening design envelope. Survey control, geotechnical criteria, right-of-way, hydraulic validation, constructability, and agency requirements must be resolved before construction documents.\n"),
        *ScenarioName,
        Inputs.BermLengthMeters,
        Inputs.BermTopWidthMeters,
        Inputs.BermHeightMeters,
        Inputs.BermSideSlopeHorizontalToVertical,
        Result.RequiredDesignElevationMeters);

    const FString GrantPath = FPaths::Combine(Root, TEXT("grant-evidence-narrative.md"));
    const FString GrantNarrative = FString::Printf(
        TEXT("# Grant Evidence Narrative\n\n")
        TEXT("## Project Need\n")
        TEXT("TSM documents a traceable engineering scenario using locally verified geospatial evidence and reproducible calculations.\n\n")
        TEXT("## Proposed Intervention\n")
        TEXT("The scenario evaluates terrain, flood exposure, freeboard, and preliminary berm/road quantities.\n\n")
        TEXT("## Quantified Screening Outputs\n")
        TEXT("- Peak runoff estimate: %.6f m^3/s\n")
        TEXT("- Flood depth: %.6f m\n")
        TEXT("- Required design elevation: %.6f m\n")
        TEXT("- Preliminary fill volume: %.6f m^3\n\n")
        TEXT("## Evidence and Limitations\n")
        TEXT("All claims must be tied to the packaged evidence manifest. Screening calculations are not regulatory determinations and do not replace calibrated hydraulic, geotechnical, survey, environmental, or cost analysis.\n"),
        Result.RationalPeakFlowCubicMetersPerSecond,
        Result.FloodDepthMeters,
        Result.RequiredDesignElevationMeters,
        Result.BermFillVolumeCubicMeters);

    const FString ManifestPath = FPaths::Combine(Root, TEXT("artifact-manifest.txt"));
    const FString Manifest = FString::Printf(
        TEXT("scenario=%s\nmethodology=%s\nreport=%s\nblueprint_notes=%s\ngrant_narrative=%s\n"),
        *ScenarioName,
        *Result.MethodologyVersion,
        *FPaths::GetCleanFilename(ReportPath),
        *FPaths::GetCleanFilename(BlueprintPath),
        *FPaths::GetCleanFilename(GrantPath));

    return FFileHelper::SaveStringToFile(BlueprintNotes, *BlueprintPath, FFileHelper::EEncodingOptions::ForceUTF8)
        && FFileHelper::SaveStringToFile(GrantNarrative, *GrantPath, FFileHelper::EEncodingOptions::ForceUTF8)
        && FFileHelper::SaveStringToFile(Manifest, *ManifestPath, FFileHelper::EEncodingOptions::ForceUTF8);
}

FString UTSMEngineeringRuntimeSubsystem::SanitizeScenarioName(const FString& Value)
{
    FString Sanitized = Value;
    const TCHAR InvalidChars[] = TEXT("\\/:*?\"<>|");
    for (const TCHAR Invalid : InvalidChars)
    {
        Sanitized.ReplaceCharInline(Invalid, TEXT('_'));
    }

    Sanitized.TrimStartAndEndInline();
    if (Sanitized.IsEmpty())
    {
        Sanitized = TEXT("scenario");
    }

    return Sanitized;
}

bool UTSMEngineeringRuntimeSubsystem::ExportEngineeringReport(
    const FString& ScenarioName,
    const FTSMEngineeringInputs& Inputs,
    const FTSMEngineeringResult& Result,
    FString& OutFilePath) const
{
    const FString Directory = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("TSM"), TEXT("EngineeringReports"));
    IFileManager::Get().MakeDirectory(*Directory, true);

    const FString SafeName = SanitizeScenarioName(ScenarioName);
    OutFilePath = FPaths::Combine(Directory, SafeName + TEXT(".md"));

    const FString Report = FString::Printf(
        TEXT("# Tri-State Systems Manager Engineering Scenario\n\n")
        TEXT("Scenario: %s\n\n")
        TEXT("## Engineering Inputs\n")
        TEXT("- Drainage area: %.3f acres\n")
        TEXT("- Runoff coefficient: %.4f\n")
        TEXT("- Rainfall intensity: %.4f in/hr\n")
        TEXT("- Manning roughness n: %.5f\n")
        TEXT("- Flow area: %.3f m^2\n")
        TEXT("- Wetted perimeter: %.3f m\n")
        TEXT("- Channel slope: %.8f\n")
        TEXT("- Existing ground elevation: %.3f m\n")
        TEXT("- Water surface elevation: %.3f m\n")
        TEXT("- Target freeboard: %.3f m\n")
        TEXT("- Scenario discharge multiplier: %.6f (source-bound input)\n\n")
        TEXT("## Calculated Results\n")
        TEXT("- Rational-method peak flow: %.6f m^3/s\n")
        TEXT("- Manning velocity: %.6f m/s\n")
        TEXT("- Manning conveyance capacity: %.6f m^3/s\n")
        TEXT("- Flood depth: %.6f m\n")
        TEXT("- Required design elevation: %.6f m\n")
        TEXT("- Berm cross-sectional area: %.6f m^2\n")
        TEXT("- Berm fill volume: %.6f m^3\n\n")
        TEXT("## Methodology and Evidence Boundary\n")
        TEXT("Methodology version: %s\n\n")
        TEXT("%s\n"),
        *ScenarioName,
        Inputs.DrainageAreaAcres,
        Inputs.RunoffCoefficient,
        Inputs.RainfallIntensityInchesPerHour,
        Inputs.ManningRoughness,
        Inputs.FlowAreaSquareMeters,
        Inputs.WettedPerimeterMeters,
        Inputs.ChannelSlope,
        Inputs.ExistingGroundElevationMeters,
        Inputs.WaterSurfaceElevationMeters,
        Inputs.TargetFreeboardMeters,
        Result.ScenarioDischargeMultiplierApplied,
        Result.RationalPeakFlowCubicMetersPerSecond,
        Result.ManningVelocityMetersPerSecond,
        Result.ManningCapacityCubicMetersPerSecond,
        Result.FloodDepthMeters,
        Result.RequiredDesignElevationMeters,
        Result.BermCrossSectionAreaSquareMeters,
        Result.BermFillVolumeCubicMeters,
        *Result.MethodologyVersion,
        *Result.UncertaintyNote);

    return FFileHelper::SaveStringToFile(
        Report,
        *OutFilePath,
        FFileHelper::EEncodingOptions::ForceUTF8);
}
