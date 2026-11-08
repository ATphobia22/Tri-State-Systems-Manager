# LAG−BFE freeboard and HEC-RAS integration

## Freeboard math

\[
\mathrm{freeboard}_{\mathrm{ft}} = \mathrm{LAG}_{\mathrm{ft}} - \mathrm{BFE}_{\mathrm{ft}}
\]

| Symbol | Meaning |
|--------|--------|
| **LAG** | Lowest Adjacent Grade — lowest ground touching the structure |
| **BFE** | Base Flood Elevation — 1% annual-chance water-surface elevation on the NFIP map / FIS |
| **Freeboard** | How far LAG sits above (positive) or below (negative) BFE |

**Bonebank modeling defaults (NAVD88):** LAG 377.2 − BFE 375.0 = **+2.2 ft**.

Implementation: `tsm-console/src/lib/lag-bfe-freeboard.ts` and `flood-engineering-toolkit.ts`.

**Limits:** Modeling only unless LAG is from a licensed surveyor/PE and BFE from effective FIRM/FIS.

## HEC-RAS “full integration” — honest boundary

HEC-RAS is **USACE desktop software** (not open-source, not redistributable as a solver inside TSM). A truthful integration is:

1. Operator builds geometry/plans in HEC-RAS.  
2. Operator runs unsteady/steady plans externally.  
3. Operator exports WSE/depth tables.  
4. TSM **imports** summaries with `humanReviewed: true` via `HecRasIntegrationBoundary.ts`.  
5. Products labeled **MODEL_SIMULATION** — not FIRM, not LOMA.

`invokeHecRasSolver` always fail-closes. There is no embedded RAS binary in this repository.

USACE: https://www.hec.usace.army.mil/software/hec-ras/

Human authority remains final.
