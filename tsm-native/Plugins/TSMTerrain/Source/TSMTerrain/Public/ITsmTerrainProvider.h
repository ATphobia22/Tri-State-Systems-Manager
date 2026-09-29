#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Terrain: TerrainRGB tiles, LiDAR, DEM staging, mesh generation, virtual
// heightfields for the Unreal runtime. Source-derived screening data; the
// bundled grids were never surveyed.
#include <cstdint>

enum class TsmTerrainSource : uint8_t
{
    TerrainRgb = 0,
    Lidar = 1,
    Dem = 2,
};

class ITsmTerrainProvider
{
public:
    virtual ~ITsmTerrainProvider() = default;
    // Register a terrain source staged under offline_packages/. Returns source handle id, or -1 on error.
    virtual int64_t RegisterSource(TsmTerrainSource kind, const char* manifestPath) = 0;
    // Generate a runtime mesh/heightfield for an EPSG:2966 tile window. Output is engine-side.
    virtual bool GenerateHeightfield(int64_t sourceId, double minX, double minY,
                                     double maxX, double maxY, uint32_t resolution) = 0;
    // Elevation query in feet (source vertical datum as documented in the manifest).
    virtual bool SampleElevation(int64_t sourceId, double x, double y, double* outFeet) = 0;
};
