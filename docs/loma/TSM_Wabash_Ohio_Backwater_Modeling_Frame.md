# Wabash–Ohio Backwater Modeling Frame (TSM)

**Status:** Analytical frame only — not a certified HEC-RAS study  
**Rule:** Label all runs SIMULATION until PE-sealed results exist  

## 1. What is being tested

Hypothesis (testable, not declared true):

> Sustained Ohio River navigation-pool stages raise the downstream boundary condition for the lower Wabash, increasing low-flow and moderate-event water-surface elevations and contributing to reduced freeboard / drainage capacity on adjacent lowlands.

## 2. Boundary conditions to assemble

| Input | Preferred source | Notes |
|-------|------------------|-------|
| Ohio mainstem stage near confluence | USGS / NWPS gauges; USACE pool records | Distinguish normal pool vs open-river |
| Wabash discharge hydrographs | USGS | Multiple events |
| Bathymetry / channel geometry | USACE surveys; published ERDC studies | Confluence avulsion/shoaling history |
| Overbank DEM | Indiana 3DEP QL2 / IGIO | EPSG:2966 + NAVD88 |
| Effective FEMA BFE / zone | NFHL + FIS | Regulatory comparison only |

## 3. Simulation cases (minimal set)

1. Low water + normal pool  
2. Ordinary high water + normal pool  
3. Flood crest with open-river operations  
4. Sensitivity: ± pool elevation uncertainty  

Outputs tagged **SIMULATION**.

## 4. What this does *not* prove alone

- That Myers was built as flood control  
- That FEMA overcharged without policy evidence  
- Inland water-table rise equals mapped SFHA without hydrogeology  

## 5. Platform hooks

- Live gauges: TSM live fabric  
- Contract: `tsm-usace-hydrologic-node-contract-v1.0.0.json`  
- Ledger promotion: human_authorized required  
