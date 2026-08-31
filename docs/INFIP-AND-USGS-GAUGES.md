# Indiana INFIP + USGS gauges — Bonebank / Posey

## INFIP (Indiana Floodplain Information Portal)

- Portal: https://infip.dnr.in.gov (DNR Division of Water)
- Shows FEMA effective layers **and** Best Available Floodplain mapping
- **FARA** (Floodplain Analysis and Regulatory Assessment) generator:
  - Required for local floodplain permitting and FEMA LOMA applications in **Zone A**
  - Also used when upstream drainage > 1 sq mi, unmapped FIRM areas, or known flood-prone sites
- Workflow: zoom to site → place point → Create/Run → download FARA PDF → **save for package**
- Contest path exists if the tool attaches the wrong stream / BFE

**Bonebank note:** An INFIP query near the Wabash may return ~**368.7 ft** BFE while the LOMA Map Pack uses **375.0 ft** structural plane. Do **not** silently overwrite Map Pack BFE — human reconciliation + sealed survey govern the filing.

## USGS stream gauges (telemetry)

### Primary — USGS **03378500** Wabash River at New Harmony, IN

| Item | Value |
|------|--------|
| Coordinates | ~38.1309°N, 87.9414°W |
| Parameters | 00065 gage height (ft), 00060 discharge (cfs) |
| Cooperation | USACE Louisville District |
| Data | **Provisional**, subject to revision |
| NWIS IV API | `https://waterservices.usgs.gov/nwis/iv/?sites=03378500&parameterCd=00065,00060&format=json` |

NWS AHPS / water.noaa.gov gauge **NHRI3** provides flood categories (action/minor/moderate/major) and NAVD88 equivalents at the gauge — **not** the structure BFE at Bonebank.

### Latest snapshot (captured in-repo)

See `tsm-console/data/gauges/usgs-03378500-iv-latest.json` (provisional). Re-fetch before any operational decision.

## Authority

| Source | Class |
|--------|--------|
| USGS IV observation | OBSERVATION (provisional) |
| INFIP FARA PDF | OBSERVATION / agency product |
| PDAL LAG from sealed LAS | DERIVATION |
| LOMA determination | Human + FEMA case **26-05-2022A** |
