#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Live and fused sensor state: gauges, telemetry feeds. Offline-first:
// feeds report STALE explicitly when no fresh data is available.
struct TsmTelemetrySample { const char* feedId; double value; long long unixMs; int stale; };
class ITsmTelemetryFeed {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual bool Latest(const char* feedId, TsmTelemetrySample* out) = 0;
    virtual bool Subscribe(const char* feedId) = 0;
};
