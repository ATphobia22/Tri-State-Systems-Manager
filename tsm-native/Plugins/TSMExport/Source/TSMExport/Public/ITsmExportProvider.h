#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Export: PDF, GeoPackage, GeoJSON, grant packages, evidence packages.
// Every package ships with a SHA-256 manifest (see TSMCrypto); export
// fails closed when attestation cannot be produced.
#include <cstdint>

enum class TsmExportKind : uint8_t
{
    Pdf = 0,
    GeoPackage = 1,
    GeoJson = 2,
    GrantPackage = 3,
    EvidencePackage = 4,
};

class ITsmExportProvider
{
public:
    virtual ~ITsmExportProvider() = default;
    // Build a package from a dataset_registry id. Writes package + .sha256 manifest
    // to outDir. Returns false when attestation fails (fail closed).
    virtual bool ExportDataset(const char* datasetId, TsmExportKind kind, const char* outDir) = 0;
};
