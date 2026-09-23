#include "TSMEmbeddedStore.h"
#include "Misc/Paths.h"
#include "sqlite/sqlite3.h"

FTSMEmbeddedStore::~FTSMEmbeddedStore()
{
    Close();
}

bool FTSMEmbeddedStore::Open(
    const FString& DatabasePath,
    const FString& SpatiaLiteLibraryPath,
    FString& OutError)
{
    Close();

    if (DatabasePath.IsEmpty())
    {
        OutError = TEXT("SQLite database path is empty.");
        return false;
    }

    if (!FPaths::FileExists(DatabasePath))
    {
        OutError = FString::Printf(
            TEXT("Immutable SQLite database does not exist: %s"),
            *DatabasePath);
        return false;
    }

    FTCHARToUTF8 PathUtf8(DatabasePath);
    const int Result = sqlite3_open_v2(
        PathUtf8.Get(),
        &Database,
        SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX,
        nullptr);

    if (Result != SQLITE_OK)
    {
        OutError = Database
            ? UTF8_TO_TCHAR(sqlite3_errmsg(Database))
            : TEXT("SQLite open failed.");
        Close();
        return false;
    }

    if (sqlite3_db_readonly(Database, "main") != 1)
    {
        OutError = TEXT("Sovereign SQLite store is not confirmed read-only.");
        Close();
        return false;
    }

    return LoadSpatiaLite(SpatiaLiteLibraryPath, OutError);
}

bool FTSMEmbeddedStore::LoadSpatiaLite(
    const FString& LibraryPath,
    FString& OutError)
{
    if (LibraryPath.IsEmpty())
    {
        OutError = TEXT("SpatiaLite library path is required in sovereign mode.");
        return false;
    }

    if (FPaths::IsRelative(LibraryPath) || !FPaths::FileExists(LibraryPath))
    {
        OutError = FString::Printf(
            TEXT("SpatiaLite library must be an existing absolute packaged file: %s"),
            *LibraryPath);
        return false;
    }

    if (sqlite3_enable_load_extension(Database, 1) != SQLITE_OK)
    {
        OutError = TEXT("SQLite extension loading could not be enabled.");
        return false;
    }

    FTCHARToUTF8 LibraryUtf8(LibraryPath);
    char* ErrorMessage = nullptr;
    const int Result = sqlite3_load_extension(
        Database,
        LibraryUtf8.Get(),
        "sqlite3_extension_init",
        &ErrorMessage);

    sqlite3_enable_load_extension(Database, 0);

    if (Result != SQLITE_OK)
    {
        OutError = UTF8_TO_TCHAR(
            ErrorMessage ? ErrorMessage : "Unable to load SpatiaLite.");
        if (ErrorMessage)
        {
            sqlite3_free(ErrorMessage);
        }
        return false;
    }

    bSpatiaLiteLoaded = true;
    return true;
}

void FTSMEmbeddedStore::Close()
{
    if (Database)
    {
        sqlite3_close(Database);
        Database = nullptr;
    }

    bSpatiaLiteLoaded = false;
}

bool FTSMEmbeddedStore::ValidateSchema(FString& OutError) const
{
    if (!Database)
    {
        OutError = TEXT("SQLite database is not open.");
        return false;
    }

    if (!bSpatiaLiteLoaded)
    {
        OutError = TEXT("SpatiaLite is not loaded.");
        return false;
    }

    static constexpr const char* Query =
        "SELECT count(*) FROM sqlite_master "
        "WHERE type='table' "
        "AND name IN ('tsm_schema_metadata','geodetic_sites');";

    sqlite3_stmt* Statement = nullptr;
    if (sqlite3_prepare_v2(Database, Query, -1, &Statement, nullptr) != SQLITE_OK)
    {
        OutError = UTF8_TO_TCHAR(sqlite3_errmsg(Database));
        return false;
    }

    const int StepResult = sqlite3_step(Statement);
    const int TableCount =
        StepResult == SQLITE_ROW ? sqlite3_column_int(Statement, 0) : 0;

    sqlite3_finalize(Statement);

    if (StepResult != SQLITE_ROW || TableCount != 2)
    {
        OutError =
            TEXT("Required sovereign geospatial schema is missing or incomplete.");
        return false;
    }

    return true;
}

bool FTSMEmbeddedStore::ReadSiteByKey(
    const FString& SiteKey,
    FTSMStoredSite& OutSite,
    FString& OutError) const
{
    if (!Database)
    {
        OutError = TEXT("SQLite database is not open.");
        return false;
    }

    FTCHARToUTF8 SiteKeyUtf8(SiteKey);
    static constexpr const char* Query =
        "SELECT site_id,site_key,horizontal_srid,vertical_datum,"
        "x_ftus,y_ftus,bfe_ft,lag_ft,stage_delta_ft "
        "FROM geodetic_sites WHERE site_key=?1 LIMIT 1;";

    sqlite3_stmt* Statement = nullptr;
    if (sqlite3_prepare_v2(Database, Query, -1, &Statement, nullptr) != SQLITE_OK)
    {
        OutError = UTF8_TO_TCHAR(sqlite3_errmsg(Database));
        return false;
    }

    sqlite3_bind_text(
        Statement, 1, SiteKeyUtf8.Get(), -1, SQLITE_TRANSIENT);

    const int StepResult = sqlite3_step(Statement);

    if (StepResult != SQLITE_ROW)
    {
        OutError = StepResult == SQLITE_DONE
            ? FString::Printf(TEXT("Site not found: %s"), *SiteKey)
            : UTF8_TO_TCHAR(sqlite3_errmsg(Database));
        sqlite3_finalize(Statement);
        return false;
    }

    OutSite.SiteId = sqlite3_column_int64(Statement, 0);
    OutSite.SiteKey =
        UTF8_TO_TCHAR(reinterpret_cast<const char*>(sqlite3_column_text(Statement, 1)));
    OutSite.HorizontalSrid = sqlite3_column_int(Statement, 2);
    OutSite.VerticalDatum =
        UTF8_TO_TCHAR(reinterpret_cast<const char*>(sqlite3_column_text(Statement, 3)));
    OutSite.X = sqlite3_column_double(Statement, 4);
    OutSite.Y = sqlite3_column_double(Statement, 5);
    OutSite.BfeFt = sqlite3_column_double(Statement, 6);
    OutSite.LagFt = sqlite3_column_double(Statement, 7);
    OutSite.StageDeltaFt = sqlite3_column_double(Statement, 8);

    sqlite3_finalize(Statement);
    return true;
}
