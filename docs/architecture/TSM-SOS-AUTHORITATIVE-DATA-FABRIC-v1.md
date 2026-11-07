# TSM-SOS Authoritative Data Fabric v1

**Policy:** Technology informs people; it does not silently govern people. Human authority remains final.

**Honesty bound:** Live connectors require network, credentials where needed, running PostGIS/Redis/Martin/GDAL/PDAL, and operational exercise. This document defines the **authoritative fabric contract**. It does not claim every endpoint is green in every environment.

## Principle

Prioritize **authoritative sources, geodesy, evidence, provenance, and reproducibility** over feature count.

## Ingest path

```text
Source → Metadata → Hash → Validation → Evidence → Storage → Publication
```

## Families

- **FEMA:** NFHL layers/query, flood zones, levees, boundaries
- **NOAA:** datums, geoid, tides, weather (provisional labeled)
- **USGS:** 3DEP/DEM, topo, geology, hydrology (stage ≠ elevation without gage datum)

## Scientific controls

| Forbidden without explicit path | Required |
|--------------------------------|----------|
| GPS height as NAVD88 | Geoid transformation + model version |
| Gage stage as elevation | Validated station gage datum |
| Silent promote invalid CRS | Quarantine + evidence hash |
| Invented BFE/WSE | Fail closed |

## Integration status

Registry declarations only. Preserve the existing validated SourceDataset interface on main. Live acquisition, external services and native runtime acceptance require their own evidence.
