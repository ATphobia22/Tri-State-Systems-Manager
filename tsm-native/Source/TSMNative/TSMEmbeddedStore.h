#pragma once

#include "CoreMinimal.h"

struct FTSMStoredSite
{
    int64 SiteId = 0;
    FString SiteKey;
    FString VerticalDatum;
    int32 HorizontalSrid = 0;
    double X = 0.0;
    double Y = 0.0;
    double BfeFt = 0.0;
    double LagFt = 0.0;
    double StageDeltaFt = 0.0;
};

struct sqlite3;

class FTSMEmbeddedStore final
{
public:
    ~FTSMEmbeddedStore();

    bool Open(const FString& DatabasePath, FString& OutError);
    void Close();
    bool InitializeSchema(FString& OutError);
    bool ReadSiteByKey(const FString& SiteKey, FTSMStoredSite& OutSite, FString& OutError) const;

private:
    sqlite3* Database = nullptr;
};
