#include "TSMArchimedesComponent.h"
#include "ArchimedesRuntime.h"
#include "Misc/Paths.h"

UTSMArchimedesComponent::UTSMArchimedesComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UTSMArchimedesComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    ShutdownArchimedes();
    Super::EndPlay(EndPlayReason);
}

bool UTSMArchimedesComponent::InitializeArchimedes(const FString& LibraryPath, FString& ErrorMessage)
{
    if (Runtime == nullptr)
    {
        Runtime = new FArchimedesRuntime();
    }

    return Runtime->Load(FPaths::ConvertRelativePathToFull(LibraryPath), ErrorMessage);
}

void UTSMArchimedesComponent::ShutdownArchimedes()
{
    if (Runtime != nullptr)
    {
        Runtime->Unload();
        delete Runtime;
        Runtime = nullptr;
    }
}

bool UTSMArchimedesComponent::IsArchimedesLoaded() const
{
    return Runtime != nullptr && Runtime->IsLoaded();
}

bool UTSMArchimedesComponent::EvaluateSite(const FTSMArchimedesSiteInput& Input, FTSMArchimedesSiteMetrics& Output, FString& ErrorMessage)
{
    if (!IsArchimedesLoaded())
    {
        ErrorMessage = TEXT("ArchimedesCore is not initialized.");
        return false;
    }

    const ArchimedesSiteInput NativeInput{
        Input.X_EPSG2966_FtUS,
        Input.Y_EPSG2966_FtUS,
        Input.BFE_Ft,
        Input.LAG_Ft,
        Input.StageDelta_Ft};

    FTSMSiteMetrics NativeOutput{};
    if (!Runtime->Evaluate(NativeInput, NativeOutput, ErrorMessage))
    {
        return false;
    }

    Output.BFE_Ft = NativeOutput.BfeFt;
    Output.LAG_Ft = NativeOutput.LagFt;
    Output.SurfaceWaterElevation_Ft = NativeOutput.SurfaceWaterElevationFt;
    Output.bInundationActive = NativeOutput.bInundationActive;
    return true;
}

bool UTSMArchimedesComponent::StepSaintVenant(const FTSMArchimedesSaintVenantConfig& Config, TArray<double>& DepthFt, TArray<double>& VelocityFps, double DeltaSeconds, FString& ErrorMessage)
{
    if (!IsArchimedesLoaded())
    {
        ErrorMessage = TEXT("ArchimedesCore is not initialized.");
        return false;
    }

    const ArchimedesSaintVenantConfig NativeConfig{
        Config.CellWidth_Ft,
        Config.BedSlope,
        Config.ManningsN,
        Config.Gravity_FtPerSec2,
        Config.CFL};

    return Runtime->StepSaintVenant(NativeConfig, DepthFt, VelocityFps, DeltaSeconds, ErrorMessage);
}
