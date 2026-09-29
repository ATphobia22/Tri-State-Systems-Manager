#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// FIRM, FIS, LOMA overlays from the evidence fabric. Screening only —
// overlays are never survey evidence or regulatory determinations.
class ITsmRegulatoryOverlay {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual bool ZoneAt(double lonDeg, double latDeg, char* outZone, int capacity) = 0;
    virtual bool BaseFloodElevation(double lonDeg, double latDeg, double* bfeFt) = 0;
};
