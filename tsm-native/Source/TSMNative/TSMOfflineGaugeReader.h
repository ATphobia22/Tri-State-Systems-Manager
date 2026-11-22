#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "TSMOfflineGaugeReader.generated.h"

/** A read-only USGS gage-height snapshot. Never an NAVD88 WSE. */
USTRUCT(BlueprintType)
struct FTSMOfflineGaugeReading
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString StationId;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString SourceStatus;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString TimeSeriesId;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString ObservedAtUtc;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString CapturedAtUtc;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString Quality;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString SourceSha256;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString VerticalReference =
        TEXT("STATION_GAGE_DATUM_UNRESOLVED");

    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") double GageHeightFt = 0.0;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") bool bHasMeasurement = false;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") bool bStale = true;
    UPROPERTY(BlueprintReadOnly, Category = "TSM|Hydrology") FString ReadingStatus =
        TEXT("SOURCE_UNAVAILABLE");
};

UCLASS()
class TSMNATIVE_API UTSMOfflineGaugeReader : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    /** Read pre-staged, source-replayed local files from Content/TSMData/observations.
      * Checks byte hash, bounded JSON, schema, station/series identities, time and datum.
      * Hash match is NOT a signature, model validation, USGS approval or live feed.
      */
    UFUNCTION(BlueprintCallable, Category = "TSM|Hydrology|Offline")
    static bool LoadPackagedGaugeViews(
        TArray<FTSMOfflineGaugeReading>& OutReadings,
        FString& OutError);
};
