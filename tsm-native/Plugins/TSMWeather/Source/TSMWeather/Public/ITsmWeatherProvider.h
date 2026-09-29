#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Weather: NOAA ingestion, forecast layers, atmospheric conditions, fog and
// rainfall scenario controls for the Unreal runtime. Screening-level only;
// never presented as forecast authority.
#include <cstdint>

struct TsmWeatherConditions
{
    double precipitationMmPerHour; // >= 0
    double fogDensity;             // 0..1
    double windSpeedMs;            // >= 0
    double windDirectionDegrees;   // 0..360
};

class ITsmWeatherProvider
{
public:
    virtual ~ITsmWeatherProvider() = default;
    // Ingest a NOAA product staged in offline_packages/noaa. Returns staged product id, or -1 on error.
    virtual int64_t IngestNoaaProduct(const char* productPath, const char* productKind) = 0;
    // Apply a rainfall scenario (e.g. SCS curve-number event) to the active scene.
    virtual bool ApplyRainfallScenario(const char* scenarioId) = 0;
    virtual bool SetAtmosphericConditions(const TsmWeatherConditions& conditions) = 0;
    virtual bool GetForecastLayer(const char* layerName, const char* outTilePath) = 0;
};
