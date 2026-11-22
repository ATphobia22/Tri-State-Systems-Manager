#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "TSMOfflineGaugeLibrary.generated.h"

USTRUCT(BlueprintType)
struct FTSMOfflineGaugeReading
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly) FString StationId;
    UPROPERTY(BlueprintReadOnly) FString ObservedUtc;
    UPROPERTY(BlueprintReadOnly) FString Quality;
    UPROPERTY(BlueprintReadOnly) FString SourceSha256;
    UPROPERTY(BlueprintReadOnly) bool bStageAvailable = false;
    UPROPERTY(BlueprintReadOnly) double StageFt = 0.0;
    UPROPERTY(BlueprintReadOnly) FString Datum = TEXT("STATION_GAGE_DATUM_UNRESOLVED");
};

/* Packaged local-only reader. No source network calls, browser or localhost.
 * SHA-256 receipt matching is byte identity, never agency authentication.
 */
UCLASS()
class TSMNATIVE_API UTSMOfflineGaugeLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="TSM|Offline Evidence")
    static bool LoadOfflineGaugeReadings(
        TArray<FTSMOfflineGaugeReading>& OutReadings,
        FString& OutStatus);
};
