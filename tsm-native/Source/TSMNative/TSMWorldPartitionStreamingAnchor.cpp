#include "TSMWorldPartitionStreamingAnchor.h"

#include "Components/SceneComponent.h"
#include "Engine/World.h"
#include "WorldPartition/WorldPartition.h"
#include "Components/WorldPartitionStreamingSourceComponent.h"

ATSMWorldPartitionStreamingAnchor::ATSMWorldPartitionStreamingAnchor()
{
    PrimaryActorTick.bCanEverTick = false;
    SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("TSMStreamingRoot")));
    StreamingSource =
        CreateDefaultSubobject<UWorldPartitionStreamingSourceComponent>(TEXT("TSMStreamingSource"));
}

void ATSMWorldPartitionStreamingAnchor::BeginPlay()
{
    Super::BeginPlay();
    // An inactive prefetch actor must never pin cells near the world origin.
    CancelPrefetch();
}

bool ATSMWorldPartitionStreamingAnchor::PrefetchAtUnrealLocation(const FVector& WorldPositionCm)
{
    UWorld* World = GetWorld();
    if (!IsValid(StreamingSource) || !World || !World->GetWorldPartition() ||
        WorldPositionCm.ContainsNaN())
    {
        return false;
    }

    // No raw projected coordinates are accepted here. The caller must
    // translate verified geodetic doubles to local Unreal centimeters first.
    if (!SetActorLocation(WorldPositionCm, false, nullptr, ETeleportType::TeleportPhysics))
    {
        return false;
    }

    StreamingSource->EnableStreamingSource();
    bPrefetchActive = true;
    return true;
}

bool ATSMWorldPartitionStreamingAnchor::IsPrefetchReady() const
{
    return bPrefetchActive &&
        IsValid(StreamingSource) &&
        StreamingSource->IsStreamingCompleted();
}

void ATSMWorldPartitionStreamingAnchor::CancelPrefetch()
{
    if (IsValid(StreamingSource))
    {
        StreamingSource->DisableStreamingSource();
    }
    bPrefetchActive = false;
}
