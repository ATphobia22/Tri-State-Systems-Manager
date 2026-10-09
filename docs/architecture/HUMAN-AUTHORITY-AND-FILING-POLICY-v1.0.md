# Human Authority & Filing Policy v1.0

**Operating principle:** Technology informs people; it does not silently govern people. Qualified human and agency authority remains final.

## Non-negotiable product rules

| Rule | TSM behavior |
|------|----------------|
| **LOMA / LOMR filing** | Human-only. System may assemble packets, checklists, LAG vs BFE helpers, and evidence hashes. **`autoFile` is always `false`.** No API submits to FEMA MSC or state portals. |
| **Grant applications** | Human-only. Matrix, deadlines, and document checklists inform the operator. No automatic submission to DOJ, FEMA EMPG, IDEM, USDA, etc. |
| **Gage → NAVD88 conversion** | Fail-closed. `conversionPublished` defaults **false**. WSE is not invented from altitude metadata. Publishing conversion requires explicit human verification of gage-zero. |
| **Commercial billing** | Disabled. No tenancy metering as a product default. |
| **3DEP / Cesium terrain** | **DERIVED** screening and visualization only. Not survey-grade vertical control, not FIRM authority, not engineering certification. |

## LOMA (Letter of Map Amendment) — process guide

LOMA is a FEMA determination that a structure or property is **outside** the SFHA based on **natural grade** (no fill). It amends the FIRM for insurance purposes; it is not a local building permit.

### Typical path (MT-1)

1. **Confirm community and panel** — Effective FIRM panel (e.g. Posey CID **180209**; verify panel ID such as **18129C0300C** vs any case-file typo).
2. **Establish vertical control** — Surveyed Lowest Adjacent Grade (LAG) and structure elevations on **NAVD88** (or document datum conversion).
3. **Compare to BFE** — LOMA natural-grade test: **LAG ≥ BFE** (freeboard is local policy, not the LOMA statutory floor). TSM helper computes freeboard and **never** sets `autoFile`.
4. **Assemble MT-1 package** — Application form, property description, tax map/APN, certified elevation data, site sketch as required by FEMA instructions for the form year in force.
5. **Human submits** — Applicant or authorized agent files through FEMA’s current channel (MSC / Online LOMC). TSM does not transmit.
6. **Agency decides** — FEMA issues LOMA, requests additional information, or denies. TSM may track case status from **documents the operator provides** only.

### LOMA vs LOMR-F (short)

| Instrument | Ground condition | Typical use |
|------------|------------------|-------------||
| **LOMA** | Natural grade | Structure/lot outside SFHA without fill |
| **LOMR-F** | Fill placed | Map revision based on fill; different form/evidence |
| **LOMR (MT-2)** | Hydrologic/hydraulic study | Broader map revision |

### Case discipline (example 26-05-2022A)

- Do **not** assert approval, denial, or “TSM rejection” without documentary proof.
- Track additional-info deadlines when letters are ingested as evidence artifacts.
- Panel mismatches (case file vs FIRMette) must be flagged before filing deadlines.

## Grant filing — process guide

1. **Select program** from the grant matrix (JAG, LEPP, EMPG, HMEP, CCMG, IDEM 319, USDA, etc.).
2. **Read eligibility and NOFO** from the funding agency — TSM summaries are decision support, not legal advice.
3. **Map evidence packets** — flood/water programs should cite TSM evidence ledger hashes, NFHL/BAFL distinction, and hydrology sources where relevant.
4. **Complete agency forms** offline or in the agency portal.
5. **Human submits and retains confirmation** — TSM stores copies only when the operator deposits them as evidence.

## Branch cleanup

After this commit, the following refs are **fully integrated** (no unique commits vs main history) and should be deleted in the GitHub UI:

- `feat/self-hosted-cesium-3dtiles`
- `fix/uacf-provider-runtime-duplicate-exports`

Automated branch deletion is not available through the current GitHub connector.
