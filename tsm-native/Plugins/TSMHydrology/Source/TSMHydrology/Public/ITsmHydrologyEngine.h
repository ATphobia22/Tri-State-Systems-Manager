#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// HEC-RAS / MODFLOW / SWMM integration. Engines run offline on operator
// workstations; this contract consumes their staged outputs (staging.ras_cells)
// and turns hydraulic state into flood surfaces. Screening only.
struct TsmHydraulicState { double depthM, wseM, velocityMS; int reviewStatus; };
class ITsmHydrologyEngine {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual bool LoadPlan(const char* planId) = 0;
    virtual bool SampleCell(const char* cellId, TsmHydraulicState* out) = 0;
    virtual bool BuildFloodSurface(const char* planId, const char* outPath) = 0;
};
