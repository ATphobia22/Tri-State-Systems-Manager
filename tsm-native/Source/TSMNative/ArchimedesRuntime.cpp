#include "ArchimedesRuntime.h"

#include "HAL/PlatformProcess.h"

bool FArchimedesRuntime::Load(const FString& LibraryPath, FString& OutError)
{
    Unload();

    if (LibraryPath.IsEmpty())
    {
        OutError = TEXT("ArchimedesCore library path is empty.");
        return false;
    }

    LibraryHandle = FPlatformProcess::GetDllHandle(*LibraryPath);
    if (LibraryHandle == nullptr)
    {
        OutError = FString::Printf(TEXT("Unable to load ArchimedesCore: %s"), *LibraryPath);
        return false;
    }

    EvaluateFn = reinterpret_cast<decltype(EvaluateFn)>(
        FPlatformProcess::GetDllExport(LibraryHandle, TEXT("ArchimedesEvaluateGeodeticInvariants")));
    StatusNameFn = reinterpret_cast<decltype(StatusNameFn)>(
        FPlatformProcess::GetDllExport(LibraryHandle, TEXT("ArchimedesStatusName")));

    if (EvaluateFn == nullptr || StatusNameFn == nullptr)
    {
        OutError = TEXT("ArchimedesCore is missing a required C ABI export.");
        Unload();
        return false;
    }

    return true;
}

void FArchimedesRuntime::Unload()
{
    EvaluateFn = nullptr;
    StatusNameFn = nullptr;

    if (LibraryHandle != nullptr)
    {
        FPlatformProcess::FreeDllHandle(LibraryHandle);
        LibraryHandle = nullptr;
    }
}

bool FArchimedesRuntime::Evaluate(
    const ArchimedesSiteInput& Input,
    FTSMSiteMetrics& OutMetrics,
    FString& OutError) const
{
    if (EvaluateFn == nullptr || StatusNameFn == nullptr)
    {
        OutError = TEXT("ArchimedesCore is not loaded.");
        return false;
    }

    ArchimedesSiteMetrics Metrics{};
    const ArchimedesStatus Status = EvaluateFn(&Input, &Metrics);

    if (Status != ARCHIMEDES_OK)
    {
        OutError = UTF8_TO_TCHAR(StatusNameFn(Status));
        return false;
    }

    OutMetrics.BfeFt = Metrics.bfe_ft;
    OutMetrics.LagFt = Metrics.lag_ft;
    OutMetrics.SurfaceWaterElevationFt = Metrics.surface_water_elevation_ft;
    return true;
}
