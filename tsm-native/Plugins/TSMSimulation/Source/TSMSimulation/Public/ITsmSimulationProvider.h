#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Simulation adapters: HEC-RAS, MODFLOW, SWMM are INTEGRATION TARGETS, not
// bundled or executed engines. Adapters translate TSM scenario definitions
// into engine inputs and stage engine outputs back into PostGIS.
// Human authority remains final over all model outputs.
#include <cstdint>

enum class TsmSimulationEngine : uint8_t
{
    HecRas = 0,
    Modflow = 1,
    Swmm = 2,
};

enum class TsmScenarioStatus : uint8_t
{
    Draft = 0,
    Ready = 1,
    Running = 2,
    Complete = 3,
    Failed = 4,
};

struct TsmScenarioHandle
{
    char scenarioId[64];
};

class ITsmSimulationProvider
{
public:
    virtual ~ITsmSimulationProvider() = default;
    // Register an engine adapter by name; returns false when the engine is unavailable.
    virtual bool RegisterEngine(TsmSimulationEngine engine, const char* adapterConfigPath) = 0;
    // Create a scenario from a TSM scenario definition file. Snapshot captures inputs for replay.
    virtual bool CreateScenario(const char* scenarioDefinitionPath, TsmScenarioHandle* outHandle) = 0;
    virtual bool SnapshotScenario(const TsmScenarioHandle& handle, const char* snapshotPath) = 0;
    virtual TsmScenarioStatus QueryScenarioStatus(const TsmScenarioHandle& handle) = 0;
    // Stage completed engine outputs into PostGIS (EPSG:2966). Returns staged row count, or -1 on error.
    virtual int64_t StageResults(const TsmScenarioHandle& handle, const char* resultsPath) = 0;
};
