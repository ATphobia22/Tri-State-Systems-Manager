#include "TSMOfflineTileset.h"
#include "TSMSceneLayerSubsystem.h"

#include "Cesium3DTileset.h"
#include "Engine/World.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/Paths.h"

namespace
{
FString ToCesiumFileUrl(const FString& AbsolutePath)
{
    FString Normalized = AbsolutePath;
    FPaths::NormalizeFilename(Normalized);
    Normalized.ReplaceInline(TEXT(" "), TEXT("%20"));

#if PLATFORM_WINDOWS
    return FString::Printf(TEXT("file:///%s"), *Normalized);
#else
    return FString::Printf(TEXT("file://%s"), *Normalized);
#endif
}
}

ATSMOfflineTileset::ATSMOfflineTileset()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ATSMOfflineTileset::BeginPlay()
{
    Super::BeginPlay();

    if (LocalTilesetJsonRelativePath.IsEmpty())
    {
        UE_LOG(LogTemp, Error, TEXT("TSM local Cesium tileset path is empty."));
        return;
    }

    FString AbsolutePath = FPaths::ConvertRelativePathToFull(
        FPaths::Combine(FPaths::ProjectDir(), LocalTilesetJsonRelativePath));
    FString LocalDataRoot = FPaths::ConvertRelativePathToFull(
        FPaths::Combine(FPaths::ProjectContentDir(), TEXT("TSMData")));
    FPaths::CollapseRelativeDirectories(AbsolutePath);
    FPaths::NormalizeFilename(AbsolutePath);
    FPaths::NormalizeDirectoryName(LocalDataRoot);
    const FString SafeDataPrefix = LocalDataRoot + TEXT("/");
    if (!AbsolutePath.StartsWith(SafeDataPrefix, ESearchCase::IgnoreCase) ||
        AbsolutePath.Contains(TEXT("#")) || AbsolutePath.Contains(TEXT("?")))
    {
        UE_LOG(LogTemp, Error, TEXT("TSM tileset must remain under local packaged TSMData."));
        return;
    }

    if (!FPaths::FileExists(AbsolutePath))
    {
        UE_LOG(
            LogTemp,
            Error,
            TEXT("TSM local Cesium tileset does not exist: %s"),
            *AbsolutePath);
        return;
    }

    UWorld* World = GetWorld();
    if (World == nullptr)
    {
        return;
    }

    TilesetActor = World->SpawnActor<ACesium3DTileset>(
        FVector::ZeroVector,
        FRotator::ZeroRotator);

    if (!IsValid(TilesetActor))
    {
        UE_LOG(LogTemp, Error, TEXT("Unable to spawn Cesium3DTileset."));
        return;
    }

    if (USceneComponent* RootComponent = TilesetActor->GetRootComponent())
    {
        RootComponent->SetMobility(EComponentMobility::Movable);
    }
    TilesetActor->SetTilesetSource(ETilesetSource::FromUrl);
    TilesetActor->SetUrl(ToCesiumFileUrl(AbsolutePath));
    TilesetActor->SetMaximumScreenSpaceError(MaximumScreenSpaceError);

    // Register the ACTUAL Cesium renderer, not the empty wrapper actor, so
    // native HUD layer toggles truly show/hide physical local geometry.
    ETSMSceneLayer Layer = ETSMSceneLayer::Buildings;
    if (LayerKind.Equals(TEXT("terrain"), ESearchCase::IgnoreCase))
    {
        Layer = ETSMSceneLayer::Terrain;
    }
    else if (LayerKind.Equals(TEXT("roads"), ESearchCase::IgnoreCase))
    {
        Layer = ETSMSceneLayer::Roads;
    }
    else if (!LayerKind.Equals(TEXT("buildings"), ESearchCase::IgnoreCase))
    {
        UE_LOG(LogTemp, Error, TEXT("TSM unsupported local 3D Tiles layer: %s"), *LayerKind);
        TilesetActor->Destroy();
        TilesetActor = nullptr;
        return;
    }

    if (UTSMSceneLayerSubsystem* Layers = World->GetSubsystem<UTSMSceneLayerSubsystem>())
    {
        // The presence of a SHA is BYTE integrity evidence, not independent
        // geoid/roof/engineering certification. Keep bSourceVerified false.
        const bool bRegistered = Layers->RegisterLayerActor(
            Layer, TilesetActor, SourceId, SourceSha256, false);
        if (!bRegistered)
        {
            UE_LOG(LogTemp, Warning, TEXT("TSM local 3D Tiles rendering has no verified source registration."));
        }
    }

    UE_LOG(
        LogTemp,
        Log,
        TEXT("TSM offline Cesium tileset mounted from %s"),
        *AbsolutePath);
}

void ATSMOfflineTileset::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (IsValid(TilesetActor))
    {
        if (UWorld* World = GetWorld())
        {
            if (UTSMSceneLayerSubsystem* Layers = World->GetSubsystem<UTSMSceneLayerSubsystem>())
            {
                Layers->UnregisterLayerActor(TilesetActor);
            }
        }
        TilesetActor->Destroy();
        TilesetActor = nullptr;
    }

    Super::EndPlay(EndPlayReason);
}
