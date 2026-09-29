#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Historical replay and forecast scenarios: 1913, 1943, 2011, current,
// 100-yr, 500-yr. Deterministic, seeded.
class ITsmTimeMachine {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual bool SetScenario(const char* scenarioId) = 0;
    virtual bool SetTime(long long unixMs) = 0;
    virtual bool Step(double deltaSeconds) = 0;
};
