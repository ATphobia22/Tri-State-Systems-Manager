#include "TSMOfflineGaugeReader.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TsmSha256.h"

namespace
{
bool IsHash(const FString& Value)
{
    if (Value.Len() != 64) return false;
    for (const TCHAR C : Value)
    {
        if (!((C >= TEXT('0') && C <= TEXT('9')) ||
              (C >= TEXT('a') && C <= TEXT('f')) ||
              (C >= TEXT('A') && C <= TEXT('F')))) return false;
    }
    return true;
}

bool ReadBounded(const FString& Path, int64 Limit, TArray<uint8>& Out)
{
    const int64 Size = IFileManager::Get().FileSize(*Path);
    if (Size < 1 || Size > Limit) return false;
    return FFileHelper::LoadFileToArray(Out, *Path) && Out.Num() == Size;
}

bool ParseObject(const TArray<uint8>& Raw, TSharedPtr<FJsonObject>& Out)
{
    // UTF-8 JSON from the Python canonical serializer; the trailing LF is valid.
    FUTF8ToTCHAR Converted(reinterpret_cast<const ANSICHAR*>(Raw.GetData()), Raw.Num());
    FString Json(Converted.Length(), Converted.Get());
    return FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Out) && Out.IsValid();
}

bool RequireLiteral(const TSharedPtr<FJsonObject>& Object, const TCHAR* Key, const TCHAR* Literal)
{
    FString Actual;
    return Object.IsValid() && Object->TryGetStringField(Key, Actual) && Actual == Literal;
}
}

bool UTSMOfflineGaugeReader::LoadPackagedGaugeViews(
    TArray<FTSMOfflineGaugeReading>& OutReadings,
    FString& OutError)
{
    OutReadings.Reset();
    OutError = TEXT("LOCAL_GAUGE_NOT_AVAILABLE");
    const FString Dir = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("TSMData"), TEXT("observations"));
    const FString ViewPath = FPaths::Combine(Dir, TEXT("gauge-view.json"));
    const FString ReceiptPath = FPaths::Combine(Dir, TEXT("gauge-view.receipt.json"));

    TArray<uint8> ReceiptRaw, ViewRaw;
    if (!ReadBounded(ReceiptPath, 16384, ReceiptRaw) ||
        !ReadBounded(ViewPath, 1024 * 1024, ViewRaw))
    {
        OutError = TEXT("LOCAL_GAUGE_FILES_MISSING_OR_OVERSIZED");
        return false;
    }

    TSharedPtr<FJsonObject> Receipt, View;
    if (!ParseObject(ReceiptRaw, Receipt) || !ParseObject(ViewRaw, View))
    {
        OutError = TEXT("INVALID_LOCAL_GAUGE_JSON");
        return false;
    }
    double Version = 0.0, ViewSize = 0.0;
    FString ExpectedDigest, ReceiptTime, ViewTime;
    if (!RequireLiteral(Receipt, TEXT("schema"), TEXT("tsm.offline-gauge-export.v1")) ||
        !Receipt->TryGetNumberField(TEXT("version"), Version) || Version != 1.0 ||
        !RequireLiteral(Receipt, TEXT("runtime"), TEXT("FILES_ONLY_NO_SERVER")) ||
        !RequireLiteral(Receipt, TEXT("authentication"), TEXT("UNSIGNED_LOCAL_SHA256_ONLY")) ||
        !RequireLiteral(Receipt, TEXT("publicPublication"), TEXT("REVIEW_REQUIRED")) ||
        !RequireLiteral(Receipt, TEXT("sourceAuthority"), TEXT("USGS"))
    {
        OutError = TEXT("INVALID_LOCAL_GAUGE_RECEIPT_SCHEMA");
        return false;
    }
    // Placeholder removed in the next condition: explicit false means no datum promotion.
    bool bHasWse = true, bHasModel = true;
    if (!Receipt->TryGetBoolField(TEXT("navd88WseIncluded"), bHasWse) || bHasWse ||
        !Receipt->TryGetBoolField(TEXT("hydraulicSimulationIncluded"), bHasModel) || bHasModel ||
        !Receipt->TryGetNumberField(TEXT("viewSize"), ViewSize) ||
        ViewSize != ViewRaw.Num() ||
        !Receipt->TryGetStringField(TEXT("viewSha256"), ExpectedDigest) || !IsHash(ExpectedDigest) ||
        !RequireLiteral(Receipt, TEXT("viewFile"), TEXT("gauge-view.json")) ||
        !Receipt->TryGetStringField(TEXT("capturedAt"), ReceiptTime))
    {
        OutError = TEXT("INVALID_LOCAL_GAUGE_RECEIPT_FIELDS");
        return false;
    }
    const TsmSha256Digest Digest = TsmComputeSha256(
        ViewRaw.GetData(), static_cast<size_t>(ViewRaw.Num()));
    const FString ActualDigest = UTF8_TO_TCHAR(TsmSha256Hex(Digest).c_str());
    if (!ActualDigest.Equals(ExpectedDigest, ESearchCase::IgnoreCase))
    {
        OutError = TEXT("LOCAL_GAUGE_SHA256_MISMATCH");
        return false;
    }

    if (!RequireLiteral(View, TEXT("schema"), TEXT("tsm.offline-gauge-view.v1")) ||
        !RequireLiteral(View, TEXT("runtime"), TEXT("FILES_ONLY_NO_SERVER")) ||
        !RequireLiteral(View, TEXT("publicPublication"), TEXT("REVIEW_REQUIRED")) ||
        !RequireLiteral(View, TEXT("engineeringUse"), TEXT("NOT_VALIDATED")) ||
        !View->TryGetBoolField(TEXT("navd88WseIncluded"), bHasWse) || bHasWse ||
        !View->TryGetBoolField(TEXT("hydraulicSimulationIncluded"), bHasModel) || bHasModel ||
        !View->TryGetStringField(TEXT("capturedAt"), ViewTime) || ViewTime != ReceiptTime)
    {
        OutError = TEXT("INVALID_LOCAL_GAUGE_VIEW_SCHEMA");
        return false;
    }

    FDateTime CapturedAt;
    if (!FDateTime::ParseIso8601(*ViewTime, CapturedAt))
    {
        OutError = TEXT("INVALID_CAPTURE_TIME");
        return false;
    }

    double StaleThreshold = 0.0;
    if (!View->TryGetNumberField(TEXT("staleAfterSeconds"), StaleThreshold) ||
        StaleThreshold <= 0.0 || StaleThreshold > 31.0 * 86400.0)
    {
        OutError = TEXT("INVALID_GAUGE_STALENESS_POLICY");
        return false;
    }

    const TSharedPtr<FJsonObject>* Stations = nullptr;
    if (!View->TryGetObjectField(TEXT("stations"), Stations) ||
        !Stations || !Stations->IsValid() || (*Stations)->Values.Num() != 3)
    {
        OutError = TEXT("INVALID_GAUGE_STATION_INVENTORY");
        return false;
    }
    TArray<FTSMOfflineGaugeReading> Pending;
    for (const TCHAR* StationName : {
        TEXT("USGS-03322000"), TEXT("USGS-03377500"), TEXT("USGS-03378500")})
    {
        const TSharedPtr<FJsonObject>* Station = nullptr;
        if (!(*Stations)->TryGetObjectField(StationName, Station) || !Station || !Station->IsValid())
        {
            OutError = TEXT("MISSING_REQUIRED_USGS_STATION");
            return false;
        }
        FString Status, SourceDigest;
        if (!(*Station)->TryGetStringField(TEXT("sourceStatus"), Status) ||
            (Status != TEXT("CAPTURED") && Status != TEXT("SOURCE_UNAVAILABLE") &&
             Status != TEXT("NO_OBSERVATIONS") && Status != TEXT("NOT_IN_CAPTURE")))
        {
            OutError = TEXT("INVALID_USGS_STATION_STATUS");
            return false;
        }
        if (Status == TEXT("CAPTURED") &&
            (!(*Station)->TryGetStringField(TEXT("sourceSha256"), SourceDigest) || !IsHash(SourceDigest)))
        {
            OutError = TEXT("CAPTURED_STATION_MISSING_SOURCE_HASH");
            return false;
        }

        const TArray<TSharedPtr<FJsonValue>>* Series = nullptr;
        if (!(*Station)->TryGetArrayField(TEXT("series"), Series) || Series == nullptr ||
            Series->Num() > 1024 || (Status != TEXT("CAPTURED") && !Series->IsEmpty()))
        {
            OutError = TEXT("INVALID_USGS_STATION_SERIES");
            return false;
        }
        if (Series->IsEmpty())
        {
            FTSMOfflineGaugeReading Empty;
            Empty.StationId = StationName;
            Empty.SourceStatus = Status;
            Empty.CapturedAtUtc = ViewTime;
            Empty.SourceSha256 = SourceDigest;
            Pending.Add(Empty);
            continue;
        }
        TSet<FString> SeenSeries;
        for (const TSharedPtr<FJsonValue>& Value : *Series)
        {
            const TSharedPtr<FJsonObject> Row = Value.IsValid() ? Value->AsObject() : nullptr;
            FTSMOfflineGaugeReading Reading;
            FString StageHash, OriginalStatus;
            if (!Row.IsValid() || !Row->TryGetStringField(TEXT("timeSeriesId"), Reading.TimeSeriesId) ||
                Reading.TimeSeriesId.IsEmpty() || SeenSeries.Contains(Reading.TimeSeriesId) ||
                !Row->TryGetStringField(TEXT("observedAt"), Reading.ObservedAtUtc) ||
                !Row->TryGetStringField(TEXT("sourceSha256"), StageHash) ||
                !StageHash.Equals(SourceDigest, ESearchCase::IgnoreCase) ||
                !Row->TryGetStringField(TEXT("verticalReference"), Reading.VerticalReference) ||
                Reading.VerticalReference != TEXT("STATION_GAGE_DATUM_UNRESOLVED") ||
                !Row->TryGetStringField(TEXT("readingStatus"), OriginalStatus) ||
                (OriginalStatus != TEXT("RECENT_OBSERVATION") &&
                 OriginalStatus != TEXT("STALE") && OriginalStatus != TEXT("MISSING_MEASUREMENT")))
            {
                OutError = TEXT("INVALID_GAGE_SERIES_IDENTITY_OR_DATUM");
                return false;
            }
            SeenSeries.Add(Reading.TimeSeriesId);
            FDateTime ObservedAt;
            if (!FDateTime::ParseIso8601(*Reading.ObservedAtUtc, ObservedAt) || ObservedAt > CapturedAt)
            {
                OutError = TEXT("GAGE_OBSERVATION_AFTER_CAPTURE");
                return false;
            }
            Reading.StationId = StationName;
            Reading.SourceStatus = Status;
            Reading.SourceSha256 = SourceDigest;
            Reading.CapturedAtUtc = ViewTime;
            Row->TryGetStringField(TEXT("quality"), Reading.Quality);
            const TSharedPtr<FJsonValue>* Height = Row->Values.Find(TEXT("gageHeightFt"));
            if (!Height || !Height->IsValid())
            {
                OutError = TEXT("MISSING_GAGE_HEIGHT_FIELD");
                return false;
            }
            if ((*Height)->Type == EJson::Null)
            {
                if (OriginalStatus != TEXT("MISSING_MEASUREMENT"))
                {
                    OutError = TEXT("GAGE_MISSING_VALUE_STATUS_MISMATCH");
                    return false;
                }
                Reading.ReadingStatus = TEXT("MISSING_MEASUREMENT");
            }
            else if ((*Height)->Type == EJson::Number &&
                     Row->TryGetNumberField(TEXT("gageHeightFt"), Reading.GageHeightFt) &&
                     FMath::IsFinite(Reading.GageHeightFt) &&
                     OriginalStatus != TEXT("MISSING_MEASUREMENT"))
            {
                Reading.bHasMeasurement = true;
                const double Age = (FDateTime::UtcNow() - ObservedAt).GetTotalSeconds();
                Reading.bStale = Age < 0.0 || Age > StaleThreshold;
                Reading.ReadingStatus = Age < 0.0 ? TEXT("LOCAL_CLOCK_BEFORE_OBSERVATION") :
                    (Reading.bStale ? TEXT("STALE") : TEXT("RECENT_OBSERVATION"));
            }
            else
            {
                OutError = TEXT("INVALID_GAGE_HEIGHT_VALUE");
                return false;
            }
            Pending.Add(MoveTemp(Reading));
        }
    }
    OutReadings = MoveTemp(Pending);
    OutError = TEXT("LOCAL_SHA256_VERIFIED_USGS_AUTHENTICITY_NOT_ESTABLISHED");
    return true;
}
