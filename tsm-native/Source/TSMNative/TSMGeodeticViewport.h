#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TSMGeodeticViewport.generated.h"

class UStaticMeshComponent;
class USceneComponent;
class FArchimedesRuntime;
class FTSMEmbeddedStore;

UCLASS()
class TSMNATIVE_API ATSMGeodeticViewport final : public AActor
{
    GENERATED_BODY()

public:
    ATSMGeodeticViewport();
    virtual ~ATSMGeodeticViewport() override;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    bool LoadAndEvaluateSite();

    UPROPERTY(VisibleAnywhere, Category = "TSM|Terrain")
    TObjectPtr<UStaticMeshComponent> TerrainRoot;

    UPROPERTY(VisibleAnywhere, Category = "TSM|Hydrology")
    TObjectPtr<USceneComponent> WaterSurface;

    UPROPERTY(EditAnywhere, Category = "TSM|Data")
    FString DatabaseRelativePath = TEXT("Content/Data/tsm-native.sqlite");

    UPROPERTY(EditAnywhere, Category = "TSM|Data")
    FString SiteKey;

    UPROPERTY(EditAnywhere, Category = "TSM|Data")
    int32 ExpectedHorizontalSrid = 2966;

    UPROPERTY(EditAnywhere, Category = "TSM|Data")
    FString ExpectedVerticalDatum;

    UPROPERTY(EditAnywhere, Category = "TSM|Runtime")
    FString ArchimedesLibraryRelativePath = TEXT("ArchimedesCore.dll");

    UPROPERTY(EditAnywhere, Category = "TSM|Runtime")
    double FeetToCentimeters = 30.48;

    TUniquePtr<FArchimedesRuntime> Runtime;
    TUniquePtr<FTSMEmbeddedStore> Store;
};
