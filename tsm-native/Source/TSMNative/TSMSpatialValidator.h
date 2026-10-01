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

private:
    static FString ComputeFileSha256(const FString& TargetFilePath);
    static bool IsSafeRelativeAssetPath(const FString& RelativeUri);
};