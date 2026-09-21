#include "TSMGeodeticViewport.h"

#include "ArchimedesRuntime.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "HAL/PlatformProcess.h"
#include "Misc/Paths.h"
#include "TSMEmbeddedStore.h"

ATSMGeodeticViewport::ATSMGeodeticViewport()
{
    PrimaryActorTick.bCanEverTick = false;

    TerrainRoot = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("TerrainRoot"));
    RootComponent = TerrainRoot;

    WaterSurface = CreateDefaultSubobject<USceneComponent>(TEXT("WaterSurface"));
    WaterSurface->SetupAttachment(RootComponent);
}

void ATSMGeodeticViewport::BeginPlay()
{
    Super::BeginPlay();

    Runtime = MakeUnique<FArchimedesRuntime>();
    Store = MakeUnique<FTSMEmbeddedStore>();

    const FString DatabasePath = FPaths::Combine(FPaths::ProjectDir(), DatabaseRelativePath);
    FString Error;

    if (!Store->Open(DatabasePath, Error) || !Store->InitializeSchema(Error))
    {
        UE_LOG(LogTemp, Error, TEXT("TSM embedded database initialization failed: %s"), *Error);
        return;
    }

#if PLATFORM_WINDOWS
    const FString LibraryName = ArchimedesLibraryRelativePath;
#elif PLATFORM_MAC
    const FString LibraryName = TEXT("libArchimedesCore.dylib");
#else
    const FString LibraryName = TEXT("libArchimedesCore.so");
#endif

    const FString LibraryPath = FPaths::Combine(FPaths::ProjectDir(), TEXT("Binaries"), LibraryName);

    if (!Runtime->Load(LibraryPath, Error))
    {
        UE_LOG(LogTemp, Error, TEXT("TSM Archimedes initialization failed: %s"), *Error);
        return;
    }

    LoadAndEvaluateSite();
}

void ATSMGeodeticViewport::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    Runtime.Reset();
    Store.Reset();
    Super::EndPlay(EndPlayReason);
}

bool ATSMGeodeticViewport::LoadAndEvaluateSite()
{
    if (!Runtime.IsValid() || !Store.IsValid())
    {
        return false;
    }

    FTSMStoredSite Site;
    FString Error;

    if (!Store->ReadSiteByKey(SiteKey, Site, Error))
    {
        UE_LOG(LogTemp, Error, TEXT("TSM site load failed: %s"), *Error);
        return false;
    }

    if (Site.HorizontalSrid != ExpectedHorizontalSrid)
    {
        UE_LOG(
            LogTemp,
            Error,
            TEXT("TSM horizontal CRS mismatch: expected EPSG:%d, received EPSG:%d"),
            ExpectedHorizontalSrid,
            Site.HorizontalSrid);
        return false;
    }

    if (!ExpectedVerticalDatum.IsEmpty() &&
        !Site.VerticalDatum.Equals(ExpectedVerticalDatum, ESearchCase::CaseSensitive))
    {
        UE_LOG(
            LogTemp,
            Error,
            TEXT("TSM vertical datum mismatch: expected %s, received %s"),
            *ExpectedVerticalDatum,
            *Site.VerticalDatum);
        return false;
    }

    ArchimedesSiteInput Input{};
    Input.x_epsg2966_m = Site.X;
    Input.y_epsg2966_m = Site.Y;
    Input.bfe_ft = Site.BfeFt;
    Input.lag_ft = Site.LagFt;
    Input.stage_delta_ft = Site.StageDeltaFt;

    FTSMSiteMetrics Metrics;
    if (!Runtime->Evaluate(Input, Metrics, Error))
    {
        UE_LOG(LogTemp, Error, TEXT("TSM solver evaluation failed: %s"), *Error);
        return false;
    }

    const double WaterElevationCentimeters = Metrics.SurfaceWaterElevationFt * FeetToCentimeters;
    WaterSurface->SetRelativeLocation(FVector(0.0, 0.0, WaterElevationCentimeters));

    UE_LOG(
        LogTemp,
        Log,
        TEXT("TSM native site %s evaluated: BFE=%.3f ft, LAG=%.3f ft, surface=%.3f ft"),
        *Site.SiteKey,
        Metrics.BfeFt,
        Metrics.LagFt,
        Metrics.SurfaceWaterElevationFt);

    return true;
}
