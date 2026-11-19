#pragma once

#include "CoreMinimal.h"
#include "Components/SplineComponent.h"
#include "GameFramework/Actor.h"
#include "TSMGeoSplineActor.generated.h"

/**
 * Source-linked GIS vector carrier for Editor-authored PCG/HLOD content.
 * This actor does not infer heights, alter terrain, or certify input evidence.
 */
UCLASS(BlueprintType, Blueprintable)
class TSMNATIVE_API ATSMGeoSplineActor : public AActor
{
    GENERATED_BODY()

public:
    ATSMGeoSplineActor();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="TSM|GIS")
    TObjectPtr<USplineComponent> GeometrySpline;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS")
    FString FeatureId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS")
    FString FeatureKind;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS")
    FString SourceSha256;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS")
    FString EvidenceStatus = TEXT("PENDING_EVIDENCE");

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS", meta=(Units="cm"))
    double HeightCm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS", meta=(Units="cm"))
    double EaveCm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS", meta=(Units="cm"))
    double WidthCm = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="TSM|GIS")
    FString RoofType = TEXT("unknown");
};
