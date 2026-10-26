#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TSMWorldPartitionStreamingAnchor.generated.h"

class UWorldPartitionStreamingSourceComponent;

/**
 * Runtime World Partition prefetch source for native Unreal actors.
 *
 * This does NOT stream Cesium 3D Tiles: Cesium retains its own tile traversal,
 * SSE budget, local cache and georeference. Locations are Unreal world-space
 * CENTIMETERS after explicit double-precision geodetic conversion, never
 * raw EPSG:2966 eastings or NAVD88 elevations.
 */
UCLASS(BlueprintType)
class TSMNATIVE_API ATSMWorldPartitionStreamingAnchor final : public AActor
{
    GENERATED_BODY()

public:
    ATSMWorldPartitionStreamingAnchor();

    /** Start an asynchronous load near a camera destination; no teleport occurs. */
    UFUNCTION(BlueprintCallable, Category="TSM|WorldPartition")
    bool PrefetchAtUnrealLocation(const FVector& WorldPositionCm);

    /** True only when this enabled source reports its requested cells loaded. */
    UFUNCTION(BlueprintCallable, Category="TSM|WorldPartition")
    bool IsPrefetchReady() const;

    UFUNCTION(BlueprintCallable, Category="TSM|WorldPartition")
    void CancelPrefetch();

protected:
    virtual void BeginPlay() override;

private:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="TSM|WorldPartition",
              meta=(AllowPrivateAccess="true"))
    TObjectPtr<UWorldPartitionStreamingSourceComponent> StreamingSource;

    UPROPERTY(Transient)
    bool bPrefetchActive = false;
};
