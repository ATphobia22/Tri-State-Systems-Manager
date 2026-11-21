#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TSMMountVernonVectorActor.generated.h"

class USplineComponent;

/** Runtime-safe, source-addressable geospatial spline. Geometry is generated in the editor, not in Shipping. */
UCLASS(BlueprintType, Blueprintable)
class TSMNATIVE_API ATSMMountVernonVectorActor : public AActor
{
    GENERATED_BODY()
public:
    ATSMMountVernonVectorActor();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="TSM|MountVernon")
    TObjectPtr<USplineComponent> Footprint;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon|Evidence")
    FString FeatureId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon|Evidence")
    FString SourceSha256;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon|Evidence")
    FString EvidenceStatus = TEXT("PENDING_EVIDENCE");

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon")
    FString Kind;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon")
    FString RoofType;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon")
    float HeightCm = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon")
    float EaveCm = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|MountVernon")
    float RoadWidthCm = 0.0f;
};
