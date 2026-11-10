#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "TSMSpatialValidator.generated.h"

USTRUCT(BlueprintType)
struct FTSM3DAssetNode
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Provenance")
    FString FileName;

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Provenance")
    FString RelativeUri;

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Provenance")
    FString ExpectedSha256;

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Provenance")
    FString ComputedSha256;

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Provenance")
    bool bProvenanceVerified = false;
};

UCLASS()
class TSMNATIVE_API UTSMSpatialValidator : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "TSM|SpatialVerification")
    static bool ValidateSpatialRuntimeFabric(
        const FString& ManifestFilePath,
        TArray<FTSM3DAssetNode>& OutVerifiedAssets);

    // Diagnostic in a shared LOCAL METRE frame, not Unreal centimetres/ECEF.
    // False means the metric is undefined; it never implies zero residual.
    UFUNCTION(BlueprintCallable, Category = "TSM|SpatialVerification")
    static bool CalculateRoofVerticalRMSE(
        const TArray<FVector>& PointsLocalMetres,
        const FVector& PlaneNormal,
        double PlaneOffsetMetres,
        double& OutRMSEMetres);

    // Infinite line only. Roof-patch clipping/adjacency is required for a ridge.
    UFUNCTION(BlueprintCallable, Category = "TSM|SpatialVerification")
    static bool ComputeUnboundedRoofPlaneIntersection(
        const FVector& FirstNormal, double FirstOffsetMetres,
        const FVector& SecondNormal, double SecondOffsetMetres,
        FVector& OutAnchorLocalMetres, FVector& OutDirection);

private:
    static FString ComputeFileSha256(const FString& TargetFilePath);
    static bool IsSafeRelativeAssetPath(const FString& RelativeUri);
};
