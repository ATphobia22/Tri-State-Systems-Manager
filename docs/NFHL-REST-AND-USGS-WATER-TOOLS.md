# NFHL REST API + USGS Water Data Tools (TSM)

## NFHL REST API usage

**Service (effective data):**
```
https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
```

Note: older path `.../gis/nfhl/rest/services/...` may 404 behind access gateways. Prefer **`/arcgis/rest/services/public/NFHL/MapServer`**.

### Key layers (IDs)

| ID | Name | TSM use |
|----|------|--------|
| 3 | FIRM Panels | Panel ID at structure (`FIRM_PAN`) |
| 28 | Flood Hazard Zones | SFHA polygons (not a determination by itself) |
| 16 | Base Flood Elevations | S_BFE lines when present |
| 1 | LOMRs | Map change polygons |
| 2 | LOMAs | Point/poly LOMC |

### Point-identify FIRM panel (Bonebank example)

```text
GET .../MapServer/3/query
  ?geometry=-88.0051,37.84589
  &geometryType=esriGeometryPoint
  &inSR=4326
  &spatialRel=esriSpatialRelIntersects
  &outFields=FIRM_PAN,DFIRM_ID,EFF_DATE,ST_FIPS,PANEL,SUFFIX
  &returnGeometry=false
  &f=json
```

**2026-09-02 result:**
- `FIRM_PAN=18129C0300C` (Posey / Indiana)
- `EFF_DATE` → 2014-11-05
- Also returned `17059C0150D` (Gallatin IL) — cross-river context only

### Authority note

NFHL is the **digital** National Flood Hazard Layer. Official NFIP products remain the effective **FIRM + FIS**. TSM uses NFHL for SSOT assist and visualization; it does **not** issue LOMA/LOMR or SFHA determinations.

---

## USGS water data tools

### Instantaneous Values (IV) — live stage / discharge

```text
https://waterservices.usgs.gov/nwis/iv/?format=json&sites={SITE}&parameterCd=00065&siteStatus=all
```

| Code | Meaning |
|------|--------|
| **00065** | Gage height, feet (**GAGE_DATUM**, not NAVD88) |
| **00060** | Discharge, ft³/s |

TSM Posey nodes: `03378500`, `03322000`, `03322420`.

Convert with published zero:
`WSE_NAVD88 ≈ gage_height + gage_zero_navd88`.

### Related services

| Service | URL pattern | Use |
|---------|-------------|-----|
| Daily values | `/nwis/dv/` | Daily means |
| Site info | `/nwis/site/` | Datum, drainage area |
| Monitoring pages | `waterdata.usgs.gov/monitoring-location/USGS-{id}/` | Human review |
| WaterAlert | waterdata.usgs.gov | Threshold alerts |

### NWS NWPS (complement)

```text
https://api.water.noaa.gov/nwps/v1/gauges/{NWS_ID}
```

AHPS pages publish **Vertical Datum Tables** (gauge zero NAVD88/NGVD29) used to lock MTVI3 / UNWK2.

### TSM policy

- Stamp raw IV/NWPS stage as **GAGE_DATUM**
- Apply conversion only when zero is published in `gage-datums.ts`
- Authority class **OBSERVATION** / provisional — human review required
- Never auto-append governance from health checks alone
