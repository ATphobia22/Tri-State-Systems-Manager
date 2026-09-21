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

    UPROPERTY(EditAnywhere, Category = "TSM|Cesium", meta = (ClampMin = "0.1"))
    double MaximumScreenSpaceError = 8.0;

    UPROPERTY()
    TObjectPtr<ACesium3DTileset> TilesetActor;
};
