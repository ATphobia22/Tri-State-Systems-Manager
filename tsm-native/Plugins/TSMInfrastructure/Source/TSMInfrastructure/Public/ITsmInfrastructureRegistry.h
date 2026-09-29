#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Roads, levees, bridges, culverts. Derived from TSMEngineeringDesignFabric.
struct TsmAssetQuery { const char* assetType; double minLon, minLat, maxLon, maxLat; };
class ITsmInfrastructureRegistry {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual int QueryAssets(const TsmAssetQuery& q, char* outGeoJson, int bufBytes) = 0;
    virtual bool AssetElevation(const char* assetId, double* crestFt, double* toeFt) = 0;
};
