#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Parcel database: ownership metadata, boundary geometry, assessment data.
// Reference only — parcel records are never survey evidence and never
// regulatory determinations.
#include <cstdint>

struct TsmParcelQuery
{
    char parcelId[64]; // e.g. 65-19-08-100-008.001-010
};

struct TsmParcelRecord
{
    char parcelId[64];
    char ownerName[128];
    char address[256];
    double assessedValue;
    // Boundary in EPSG:2966 (NAD83 / Indiana West, ftUS), WKT polygon.
    char boundaryWkt[4096];
};

class ITsmParcelProvider
{
public:
    virtual ~ITsmParcelProvider() = default;
    virtual bool LookupParcel(const TsmParcelQuery& query, TsmParcelRecord* outRecord) = 0;
    // Spatial query: parcels intersecting an EPSG:2966 bounding box. Returns count written, or -1 on error.
    virtual int64_t QueryParcelsInBounds(double minX, double minY, double maxX, double maxY,
                                         TsmParcelRecord* outRecords, int64_t maxRecords) = 0;
};
