#pragma once
#include "CoreMinimal.h"
struct sqlite3;
struct FTSMStoredSite { int64 SiteId=0; FString SiteKey; FString VerticalDatum; int32 HorizontalSrid=0; double X=0.0; double Y=0.0; double BfeFt=0.0; double LagFt=0.0; double StageDeltaFt=0.0; };
class FTSMEmbeddedStore final {
public:
 ~FTSMEmbeddedStore();
 bool Open(const FString& DatabasePath,const FString& SpatiaLiteLibraryPath,FString& OutError);
 void Close();
 bool ValidateSchema(FString& OutError) const;
 bool ReadSiteByKey(const FString& SiteKey,FTSMStoredSite& OutSite,FString& OutError) const;
 bool IsSpatiaLiteLoaded() const { return bSpatiaLiteLoaded; }
private:
 bool LoadSpatiaLite(const FString& LibraryPath,FString& OutError);
 sqlite3* Database=nullptr;
 bool bSpatiaLiteLoaded=false;
};