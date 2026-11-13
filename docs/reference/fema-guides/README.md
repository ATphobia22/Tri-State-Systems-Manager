# FEMA Technical Guides — Reference Library

Official FEMA/USACE software documentation relevant to TSM flood work.

## Guides

### RASPLOT v3 User Guide (2015)
**File:** `rasplot_v3_user-guide.pdf` (3.2 MB)

FEMA's official tool for extracting flood profiles from HEC-RAS hydraulic modeling files. Flood profiles are required for FIS reports.

**TSM relevance:** Our `scripts/flood-forecasting/bfe_ingestion.py` implements the same workflow (HEC-RAS → flood profiles → BFE extraction) in Python. RASPLOT is the Windows desktop reference implementation.

### cHECk-RAS 2.0.1 User Guide
**File:** `check-ras-user-guide.pdf` (1.5 MB)

FEMA's historic **steady-flow** model review aid. Its documentation lists checks for Manning's roughness and transition losses, cross sections, structures, floodway profiles and WSE consistency; these checks **flag potential problems**, they do not certify correctness. The published cHECk-RAS 2.0.1 guide (December 2013) explicitly states it **does not support unsteady-flow models** and specifies **HEC-RAS 4.1.0** as a runtime requirement.

**TSM relevance:** Use the checks as an *informational QA checklist* for supported steady-flow inputs and model output; never label an unsteady HEC-RAS 6.x or 2D result as having passed cHECk-RAS 2.0.1, and do not claim cHECk-RAS is installed, supported on UE5.8, or an NFIP acceptance authority.

### FEMA 480 — Floodplain Management Study Guide for Local Officials
**File:** `fema-480-floodplain-management-study-guide.pdf` (10 MB)

Comprehensive guide to floodplain management for local officials. Covers NFIP requirements, floodplain regulations, and community responsibilities.

**TSM relevance:** Historical orientation for local Posey County floodplain administrators; **February 2005 guide, not a substitute for current NFIP regulations, current effective FIRM/FIS, Indiana DNR rules, local ordinances or survey certification**.

## Not Included

- **CHAMP 2.0 Manual** — Coastal Hazard Analysis Modeling Program. Coastal-only, not relevant to Ohio River inland flooding.

## Uploaded guidance crosswalk (2026-11-13)
The user-supplied documents have been studied as **references**, not ingested as software or presented as regulatory approvals. See [Source scope and applicability](../../regulatory/TSM-UPLOADED-SOURCE-APPLICABILITY-2026-11-13.md) for document scope, evidence hash, relevance and explicit non-application decisions.

For regulatory mapping, [FEMA Guidance 98 (December 2020)](https://www.fema.gov/flood-maps/guidance-partners/guidelines-standards) distinguishes Category 1 pre/post-processing tools from Category 2/3 numerical models that must independently meet 44 CFR 65.6(a)(6). **TSM's maps, visualizers and scientific simulation interfaces are not themselves FEMA-accepted mapping models.** The uploaded FEMA Rev. 14 (Policy #204-078-1) is a dated reference: verify the applicable current standards and project-specific agency guidance before submission.
