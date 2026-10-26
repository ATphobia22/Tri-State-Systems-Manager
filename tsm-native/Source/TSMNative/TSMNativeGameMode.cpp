#include "TSMNativeGameMode.h"

#include "TSMEngineeringHUD.h"
#include "TSMWorldPartitionStreamingAnchor.h"
#include "Engine/World.h"
#include "WorldPartition/WorldPartition.h"

ATSMNativeGameMode::ATSMNativeGameMode()
{
    HUDClass = ATSMEngineeringHUD::StaticClass();
}


void ATSMNativeGameMode::BeginPlay()
{
    Super::BeginPlay();

    UWorld* World = GetWorld();
    if (!World || !World->GetWorldPartition())
    {
        UE_LOG(LogTemp, Warning,
            TEXT("TSM World Partition prefetch inactive: active map is not partitioned. Cesium streaming remains independent."));
        return;
    }

    StreamingAnchor = World->SpawnActor<ATSMWorldPartitionStreamingAnchor>(
        FVector::ZeroVector, FRotator::ZeroRotator);
    if (!IsValid(StreamingAnchor))
    {
        UE_LOG(LogTemp, Error, TEXT("TSM World Partition prefetch actor could not be created."));
    }
}
