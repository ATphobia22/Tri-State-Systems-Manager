#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IHttpRequest.h"
#include "TSMSpatialValidator.h"
#include "TSMManifestDownloader.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FTSMManifestVerificationComplete,
    const TArray<FTSM3DAssetNode>&,
    VerifiedAssets,
    bool,
    bSystemPassedCompliance);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FTSMManifestVerificationFailed,
    const FString&,
    FailReason);

UCLASS()
class TSMNATIVE_API UTSMManifestDownloader : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "TSM|NetworkIngestion")
    void DispatchManifestDownloadTask(
        const FString& SecureTargetUrl,
        const FString& LocalDataStoragePath);

    UPROPERTY(BlueprintAssignable, Category = "TSM|NetworkIngestion")
    FTSMManifestVerificationComplete OnVerificationComplete;

    UPROPERTY(BlueprintAssignable, Category = "TSM|NetworkIngestion")
    FTSMManifestVerificationFailed OnVerificationFailed;

private:
    void OnManifestResponseReceived(
        FHttpRequestPtr Request,
        FHttpResponsePtr Response,
        bool bWasConnectedSuccessfully);

    FString CachedLocalPath;
};