#include "TSMOfflineTileset.h"

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

    const FString AbsolutePath = FPaths::ConvertRelativePathToFull(
        FPaths::Combine(FPaths::ProjectDir(), LocalTilesetJsonRelativePath));

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

    TilesetActor->GetRootComponent()->SetMobility(EComponentMobility::Movable);
    TilesetActor->SetTilesetSource(ETilesetSource::FromUrl);
    TilesetActor->SetUrl(ToCesiumFileUrl(AbsolutePath));
    TilesetActor->SetMaximumScreenSpaceError(MaximumScreenSpaceError);

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
        TilesetActor->Destroy();
        TilesetActor = nullptr;
    }

    Super::EndPlay(EndPlayReason);
}
