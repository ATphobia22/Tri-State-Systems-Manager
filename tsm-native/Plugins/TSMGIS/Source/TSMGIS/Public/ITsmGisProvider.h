#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Authoritative spatial layers: PMTiles, GeoTIFF, Terrain-RGB, vector tiles.
// Reference basemaps (MapKit/Cesium/MapLibre) are context only — never elevation truth.
struct TsmTileRequest { int z, x, y; const char* layerId; };
class ITsmGisProvider {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual bool GetTile(const TsmTileRequest& req, unsigned char* outBuf, int bufBytes, int* outBytes) = 0;
    virtual double SampleElevation(double lonDeg, double latDeg, bool* ok) = 0;
};
