#include "TSMEmbeddedStore.h"

#include "HAL/PlatformFileManager.h"
#include "Misc/Paths.h"
#include "sqlite/sqlite3.h"

namespace
{
bool ExecuteSql(sqlite3* Database, const char* Sql, FString& OutError)
{
    char* ErrorMessage = nullptr;
    const int Result = sqlite3_exec(Database, Sql, nullptr, nullptr, &ErrorMessage);

    if (Result == SQLITE_OK)
    {
        return true;
    }

    OutError = UTF8_TO_TCHAR(ErrorMessage != nullptr ? ErrorMessage : "SQLite error");
    sqlite3_free(ErrorMessage);
    return false;
}
}

FTSMEmbeddedStore::~FTSMEmbeddedStore()
{
    Close();
}

bool FTSMEmbeddedStore::Open(const FString& DatabasePath, FString& OutError)
{
    Close();

    if (DatabasePath.IsEmpty())
    {
        OutError = TEXT("SQLite database path is empty.");
        return false;
    }

    const FString Directory = FPaths::GetPath(DatabasePath);
    if (!Directory.IsEmpty() && !IFileManager::Get().MakeDirectory(*Directory, true))
    {
        OutError = FString::Printf(TEXT("Unable to create database directory: %s"), *Directory);
        return false;
    }

    FTCHARToUTF8 PathUtf8(DatabasePath);
    const int Result = sqlite3_open_v2(
        PathUtf8.Get(),
        &Database,
        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
        nullptr);

    if (Result != SQLITE_OK)
    {
        OutError = Database != nullptr
            ? UTF8_TO_TCHAR(sqlite3_errmsg(Database))
            : TEXT("SQLite open failed.");
        Close();
        return false;
    }

    return true;
}

void FTSMEmbeddedStore::Close()
{
    if (Database != nullptr)
    {
        sqlite3_close(Database);
        Database = nullptr;
    }
}

bool FTSMEmbeddedStore::InitializeSchema(FString& OutError)
{
    if (Database == nullptr)
    {
        OutError = TEXT("SQLite database is not open.");
        return false;
    }

    static constexpr const char* Schema = R"SQL(
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS tsm_schema_metadata (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS geodetic_sites (
            site_id INTEGER PRIMARY KEY,
            site_key TEXT NOT NULL UNIQUE,
            horizontal_srid INTEGER NOT NULL,
            vertical_datum TEXT NOT NULL,
            x_m REAL NOT NULL,
            y_m REAL NOT NULL,
            bfe_ft REAL NOT NULL,
            lag_ft REAL NOT NULL,
            stage_delta_ft REAL NOT NULL,
            CHECK (horizontal_srid > 0),
            CHECK (x_m >= 0.0),
            CHECK (y_m >= 0.0),
            CHECK (lag_ft >= bfe_ft)
        );

        CREATE INDEX IF NOT EXISTS idx_geodetic_sites_xy
            ON geodetic_sites(horizontal_srid, x_m, y_m);
    )SQL";

    return ExecuteSql(Database, Schema, OutError);
}

bool FTSMEmbeddedStore::ReadSiteByKey(
    const FString& SiteKey,
    FTSMStoredSite& OutSite,
    FString& OutError) const
{
    if (Database == nullptr)
    {
        OutError = TEXT("SQLite database is not open.");
        return false;
    }

    FTCHARToUTF8 SiteKeyUtf8(SiteKey);
    static constexpr const char* Query =
        "SELECT site_id, site_key, horizontal_srid, vertical_datum, "
        "x_m, y_m, bfe_ft, lag_ft, stage_delta_ft "
        "FROM geodetic_sites WHERE site_key = ?1 LIMIT 1;";

    sqlite3_stmt* Statement = nullptr;
    if (sqlite3_prepare_v2(Database, Query, -1, &Statement, nullptr) != SQLITE_OK)
    {
        OutError = UTF8_TO_TCHAR(sqlite3_errmsg(Database));
        return false;
    }

    sqlite3_bind_text(Statement, 1, SiteKeyUtf8.Get(), -1, SQLITE_TRANSIENT);

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
    OutSite.SiteKey = UTF8_TO_TCHAR(reinterpret_cast<const char*>(sqlite3_column_text(Statement, 1)));
    OutSite.HorizontalSrid = sqlite3_column_int(Statement, 2);
    OutSite.VerticalDatum = UTF8_TO_TCHAR(reinterpret_cast<const char*>(sqlite3_column_text(Statement, 3)));
    OutSite.X = sqlite3_column_double(Statement, 4);
    OutSite.Y = sqlite3_column_double(Statement, 5);
    OutSite.BfeFt = sqlite3_column_double(Statement, 6);
    OutSite.LagFt = sqlite3_column_double(Statement, 7);
    OutSite.StageDeltaFt = sqlite3_column_double(Statement, 8);

    sqlite3_finalize(Statement);
    return true;
}
