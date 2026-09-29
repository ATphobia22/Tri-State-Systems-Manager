#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Lifecycle contract every TSM plugin module implements.
class ITsmModule {
public:
    virtual ~ITsmModule() = default;
    virtual const char* ModuleName() const = 0;
    virtual bool Startup() = 0;
    virtual void Shutdown() = 0;
    virtual bool IsHealthy(char* outStatus, int statusCapacity) const = 0;
};
