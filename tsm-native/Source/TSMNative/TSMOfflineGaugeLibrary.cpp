#include "TSMOfflineGaugeLibrary.h"
#include "TsmSha256.h"
#include "Containers/StringConv.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
constexpr int64 MaxSmall = 4 * 1024 * 1024;
constexpr int64 MaxEvents = 16 * 1024 * 1024;

bool Bytes(const FString& Filename, int64 Limit, TArray<uint8>& Data)
{
    const int64 Size = IFileManager::Get().FileSize(*Filename);
    return Size >= 0 && Size <= Limit &&
        FFileHelper::LoadFileToArray(Data, *Filename) && Data.Num() == Size;
}
FString Sha256(const TArray<uint8>& Data)
{
    const std::string Hash = TsmSha256HexOfString(
        reinterpret_cast<const char*>(Data.GetData()), static_cast<size_t>(Data.Num()));
    return UTF8_TO_TCHAR(Hash.c_str());
}
FString TextOf(const TArray<uint8>& Data)
{
    const FUTF8ToTCHAR Value(reinterpret_cast<const ANSICHAR*>(Data.GetData()), Data.Num());
    return FString(Value.Length(), Value.Get());
}
bool Object(const FString& Text, TSharedPtr<FJsonObject>& Out)
{
    return FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Out) && Out.IsValid();
}
bool String(const TSharedPtr<FJsonObject>& Json, const TCHAR* Key, FString& Value)
{
    return Json.IsValid() && Json->TryGetStringField(Key, Value);
}
bool AllowedFile(const FString& Name)
{
    return Name == TEXT("events.ndjson") ||
        Name == TEXT("source/manifest.json") ||
        Name == TEXT("source/03322000.geojson") ||
        Name == TEXT("source/03377500.geojson") ||
        Name == TEXT("source/03378500.geojson");
}
bool VerifyFiles(const FString& Root, const TSharedPtr<FJsonObject>& Manifest,
    TMap<FString, FString>& SourceHashes, FString& Status)
{
    const TSharedPtr<FJsonObject>* Files = nullptr;
    if (!Manifest->TryGetObjectField(TEXT("files"), Files) ||
        !Files || !Files->IsValid() || (*Files)->Values.Num() < 2 ||
        (*Files)->Values.Num() > 5)
    {
        Status = TEXT("OFFLINE_FILE_INVENTORY_INVALID");
        return false;
    }
    for (const auto& Entry : (*Files)->Values)
    {
        if (!AllowedFile(Entry.Key) || !Entry.Value.IsValid() ||
            Entry.Value->Type != EJson::Object)
        {
            Status = TEXT("OFFLINE_FILE_PATH_NOT_ALLOWED");
            return false;
        }
        const auto Record = Entry.Value->AsObject();
        FString Expected;
        double Size = -1;
        if (!String(Record, TEXT("sha256"), Expected) || Expected.Len() != 64 ||
            !Record->TryGetNumberField(TEXT("size"), Size))
        {
            Status = TEXT("OFFLINE_SHA256_RECEIPT_INVALID");
            return false;
        }
        TArray<uint8> Data;
        if (!Bytes(FPaths::Combine(Root, Entry.Key),
                   Entry.Key == TEXT("events.ndjson") ? MaxEvents : MaxSmall, Data) ||
            static_cast<double>(Data.Num()) != Size || Sha256(Data) != Expected)
        {
            Status = TEXT("OFFLINE_FILE_SHA256_OR_SIZE_MISMATCH");
            return false;
        }
        SourceHashes.Add(Entry.Key, Expected);
    }
    if (!SourceHashes.Contains(TEXT("source/manifest.json")) ||
        !SourceHashes.Contains(TEXT("events.ndjson")))
    {
        Status = TEXT("OFFLINE_SOURCE_AND_EVENTS_REQUIRED");
        return false;
    }
    return true;
}
}

bool UTSMOfflineGaugeLibrary::LoadOfflineGaugeReadings(
    TArray<FTSMOfflineGaugeReading>& OutReadings, FString& OutStatus)
{
    OutReadings.Reset();
    const FString Root = FPaths::Combine(FPaths::ProjectContentDir(),
        TEXT("TSMData"), TEXT("offline-observations"));
    TArray<uint8> ReceiptBytes;
    TSharedPtr<FJsonObject> Receipt;
    if (!Bytes(FPaths::Combine(Root, TEXT("bundle.json")), MaxSmall, ReceiptBytes) ||
        !Object(TextOf(ReceiptBytes), Receipt))
    {
        OutStatus = TEXT("OFFLINE_BUNDLE_MISSING_OR_INVALID");
        return false;
    }
    FString Schema, Authority, Datum, Publication, Matrix, Timeline;
    double Count = -1;
    bool Navd88 = true, Simulation = true;
    if (!String(Receipt, TEXT("schema"), Schema) ||
        Schema != TEXT("tsm.offline-observation-bundle.v1") ||
        !String(Receipt, TEXT("sourceAuthority"), Authority) || Authority != TEXT("USGS") ||
        !String(Receipt, TEXT("matrix"), Matrix) || Matrix != TEXT("O") ||
        !String(Receipt, TEXT("timeline"), Timeline) || Timeline != TEXT("observed") ||
        !String(Receipt, TEXT("stageDatum"), Datum) ||
        Datum != TEXT("USGS_STATION_GAGE_DATUM_UNCONVERTED") ||
        !String(Receipt, TEXT("publicPublication"), Publication) ||
        Publication != TEXT("REVIEW_REQUIRED") ||
        !Receipt->TryGetNumberField(TEXT("eventCount"), Count) ||
        Count < 0 || Count > 10000 || FMath::FloorToDouble(Count) != Count ||
        !Receipt->TryGetBoolField(TEXT("navd88WseIncluded"), Navd88) || Navd88 ||
        !Receipt->TryGetBoolField(TEXT("hydraulicSimulationIncluded"), Simulation) ||
        Simulation)
    {
        OutStatus = TEXT("OFFLINE_BUNDLE_AUTHORITY_INVALID");
        return false;
    }
    TMap<FString, FString> Verified;
    if (!VerifyFiles(Root, Receipt, Verified, OutStatus)) return false;

    TArray<uint8> EventBytes;
    if (!Bytes(FPaths::Combine(Root, TEXT("events.ndjson")), MaxEvents, EventBytes))
    {
        OutStatus = TEXT("OFFLINE_EVENTS_UNAVAILABLE");
        return false;
    }
    TArray<FString> Lines;
    TextOf(EventBytes).ParseIntoArrayLines(Lines);
    if (Lines.Num() != static_cast<int32>(Count))
    {
        OutStatus = TEXT("OFFLINE_EVENT_COUNT_INVALID");
        return false;
    }
    TArray<FTSMOfflineGaugeReading> Readings;
    TSet<FString> Seen;
    for (const FString& Line : Lines)
    {
        TSharedPtr<FJsonObject> E;
        if (Line.Len() > 750000 || !Object(Line, E))
        {
            OutStatus = TEXT("OFFLINE_EVENT_JSON_INVALID");
            return false;
        }
        FString M, T, B, Operation, Id, Utc;
        if (!String(E, TEXT("matrix"), M) || M != TEXT("O") ||
            !String(E, TEXT("timeline"), T) || T != TEXT("observed") ||
            !String(E, TEXT("branch"), B) || B != TEXT("main") ||
            !String(E, TEXT("operation"), Operation) || Operation != TEXT("upsert") ||
            !String(E, TEXT("event_id"), Id) || Seen.Contains(Id) ||
            !String(E, TEXT("valid_from"), Utc) || !Utc.EndsWith(TEXT("Z")))
        {
            OutStatus = TEXT("OFFLINE_EVENT_CONTRACT_INVALID");
            return false;
        }
        Seen.Add(Id);
        const TSharedPtr<FJsonObject>* State = nullptr;
        const TSharedPtr<FJsonObject>* Source = nullptr;
        if (!E->TryGetObjectField(TEXT("state"), State) || !State || !State->IsValid() ||
            !E->TryGetObjectField(TEXT("source"), Source) || !Source || !Source->IsValid())
        {
            OutStatus = TEXT("OFFLINE_EVENT_EVIDENCE_MISSING");
            return false;
        }
        FTSMOfflineGaugeReading Row;
        FString Unit, Param, Original;
        if (!String(*State, TEXT("sensor_id"), Row.StationId) ||
            !String(*State, TEXT("quality"), Row.Quality) ||
            !String(*State, TEXT("unit"), Unit) || Unit != TEXT("ft") ||
            !String(*State, TEXT("parameter"), Param) || Param != TEXT("00065") ||
            !String(*State, TEXT("vertical_reference"), Row.Datum) ||
            Row.Datum != TEXT("STATION_GAGE_DATUM_UNRESOLVED") ||
            !String(*Source, TEXT("authority"), Original) || Original != TEXT("USGS") ||
            !String(*Source, TEXT("sha256"), Row.SourceSha256))
        {
            OutStatus = TEXT("OFFLINE_OBSERVATION_SOURCE_OR_DATUM_INVALID");
            return false;
        }
        FString StationNumber;
        if (Row.StationId == TEXT("USGS-03322000")) StationNumber = TEXT("03322000");
        else if (Row.StationId == TEXT("USGS-03377500")) StationNumber = TEXT("03377500");
        else if (Row.StationId == TEXT("USGS-03378500")) StationNumber = TEXT("03378500");
        if (StationNumber.IsEmpty() || Row.SourceSha256 !=
            Verified.FindRef(TEXT("source/") + StationNumber + TEXT(".geojson")))
        {
            OutStatus = TEXT("OFFLINE_OBSERVATION_STATION_OR_HASH_MISMATCH");
            return false;
        }
        FDateTime Parsed;
        if (!FDateTime::ParseIso8601(*Utc, Parsed))
        {
            OutStatus = TEXT("OFFLINE_OBSERVATION_TIMESTAMP_INVALID");
            return false;
        }
        Row.ObservedUtc = Utc;
        const TSharedPtr<FJsonValue>* Stage = (*State)->Values.Find(TEXT("value"));
        if (Stage && Stage->IsValid() && (*Stage)->Type == EJson::Number)
        {
            Row.StageFt = (*Stage)->AsNumber();
            Row.bStageAvailable = FMath::IsFinite(Row.StageFt);
            if (!Row.bStageAvailable)
            {
                OutStatus = TEXT("OFFLINE_STAGE_NONFINITE");
                return false;
            }
        }
        else if (!Stage || !Stage->IsValid() || (*Stage)->Type != EJson::Null)
        {
            OutStatus = TEXT("OFFLINE_STAGE_SHOULD_BE_NULL_OR_FINITE_NUMBER");
            return false;
        }
        Readings.Add(Row);
    }
    OutReadings = MoveTemp(Readings);
    OutStatus = OutReadings.IsEmpty()
        ? TEXT("OFFLINE_CAPTURE_AVAILABLE_NO_OBSERVATIONS")
        : TEXT("LOCAL_SHA256_RECEIPTS_MATCH_GAGE_DATUM_UNRESOLVED_NOT_CERTIFIED");
    return true;
}
