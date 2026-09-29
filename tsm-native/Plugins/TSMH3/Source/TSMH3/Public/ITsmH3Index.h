#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// H3 spatial indexing for the offline tileset.
class ITsmH3Index {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual unsigned long long LatLonToCell(double latDeg, double lonDeg, int resolution) = 0;
    virtual bool CellToBoundary(unsigned long long cell, double* outLats, double* outLons, int* count, int capacity) = 0;
};
