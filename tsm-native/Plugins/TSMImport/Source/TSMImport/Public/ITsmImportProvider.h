#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Import: LAS, LAZ, GeoTIFF, Shapefile, FGDB, PMTiles, GeoJSON.
// Validates provenance and stages into PostGIS (EPSG:2966). PDAL is an
// integration target, not a bundled tool.
#include <cstdint>

enum class TsmImportFormat : uint8_t
{
    Las = 0,
    Laz = 1,
    GeoTiff = 2,
    Shapefile = 3,
    FileGdb = 4,
    PmTiles = 5,
    GeoJson = 6,
};

enum class TsmImportVerdict : uint8_t
{
    Accepted = 0,
    Quarantined = 1,
    Rejected = 2,
};

struct TsmImportResult
{
    TsmImportVerdict verdict;
    char datasetId[64]; // dataset_registry key on Accepted
    char reason[256];
};

class ITsmImportProvider
{
public:
    virtual ~ITsmImportProvider() = default;
    // Validate + stage a file. On Accepted, registers the dataset in dataset_registry
    // with its SHA-256 (see TSMCrypto) and returns the dataset id.
    virtual bool ImportFile(const char* path, TsmImportFormat format, TsmImportResult* outResult) = 0;
};
