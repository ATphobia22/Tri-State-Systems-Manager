#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TSMOfflineTileset.generated.h"

class ACesium3DTileset;

UCLASS()
class TSMNATIVE_API ATSMOfflineTileset final : public AActor
{
    GENERATED_BODY()

public:
    ATSMOfflineTileset();

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    UPROPERTY(EditAnywhere, Category = "TSM|Cesium")
    FString LocalTilesetJsonRelativePath;

    // A real 3D Tiles layer: terrain, buildings or roads. No fake source geometry.
    UPROPERTY(EditAnywhere, Category = "TSM|Cesium")
    FString LayerKind = TEXT("buildings");

    // These hashes establish byte identity only. The runtime MUST NOT promote
    // them to independent geodetic or regulatory source verification.
    UPROPERTY(EditAnywhere, Category = "TSM|Provenance")
    FString SourceId;

    UPROPERTY(EditAnywhere, Category = "TSM|Provenance")
    FString SourceSha256;

    UPROPERTY(EditAnywhere, Category = "TSM|Cesium", meta = (ClampMin = "0.1"))
    double MaximumScreenSpaceError = 8.0;

    UPROPERTY()
    TObjectPtr<ACesium3DTileset> TilesetActor;
};
