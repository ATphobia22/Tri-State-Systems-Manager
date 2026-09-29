#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Single operational runtime: owns module load order, config, and frame tick.
class ITsmRuntime {
public:
    virtual ~ITsmRuntime() = default;
    virtual bool Initialize(const char* configPath) = 0;
    virtual void Tick(double deltaSeconds) = 0;
    virtual void Shutdown() = 0;
    virtual ITsmServiceRegistry& Services() = 0;
};
