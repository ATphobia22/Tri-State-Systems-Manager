# LOMA: LAG vs BFE requirements

## Definitions

| Term | Meaning |
|------|---------|
| **BFE** | Base Flood Elevation — water-surface elevation of the 1%-annual-chance flood on the **effective** FIRM/FIS (NAVD88 when so referenced) |
| **LAG** | Lowest Adjacent Grade — lowest elevation of the **ground touching the structure** (including attached slabs, garages, decks as applicable per survey practice) |

## Structure LOMA elevation test

```text
eligible (structure path)  ⇔  LAG ≥ BFE
freeboard / residual       =  LAG − BFE
```

- **LAG ≥ BFE** → elevation criterion for removing the **structure** from the SFHA may be met (FEMA still decides).
- **LAG < BFE** → structure LOMA on elevation fails.
- **Lot removal** uses the **lowest point on the lot**, not only LAG at the building.

## Pure LOMA vs LOMR-F

| Condition | Product |
|-----------|---------|
| Natural grade (no fill relied upon) | **LOMA** |
| Elevated by fill | **LOMR-F** (+ community “reasonably safe” finding + fee) |

## Application requirements (structure LOMA)

1. Effective FIRMette / panel ID  
2. Property identification (deed + tax map/plat)  
3. Certified elevations (surveyor or PE) — LAG and BFE source  
4. MT-EZ (single residential) or MT-1 / Online LOMC  
5. No FEMA review fee for standard LOMA  
6. Human package review before submit  

**TSM working values (uncertified unless survey seals):** LAG **377.2** · BFE **375.0** · Δ **+2.2 ft** · panel **18129C0300C**.

## What does not substitute for LAG

- USGS/NOAA **gage stage**  
- Indiana **BAFL** alone  
- Desktop DEM without surveyor certification (unless FEMA accepts specific BLE path for that case)

## TSM software

`LomaLagBfeChecklist` evaluates LAG−BFE and **disables** FEMA submit. ADR-006 forbids auto-file.
