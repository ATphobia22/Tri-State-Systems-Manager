# FEMA Technical Guides — Reference Library

Official FEMA/USACE software documentation relevant to TSM flood work.

## Guides

### RASPLOT v3 User Guide (2015)
**File:** `rasplot_v3_user-guide.pdf` (3.2 MB)

FEMA's official tool for extracting flood profiles from HEC-RAS hydraulic modeling files. Flood profiles are required for FIS reports.

**TSM relevance:** Our `scripts/flood-forecasting/bfe_ingestion.py` implements the same workflow (HEC-RAS → flood profiles → BFE extraction) in Python. RASPLOT is the Windows desktop reference implementation.

### cHECk-RAS 2.0.1 User Guide
**File:** `check-ras-user-guide.pdf` (1.5 MB)

FEMA's tool for verifying HEC-RAS model parameters. Validates the correctness of hydraulic modeling inputs.

**TSM relevance:** Could be used to validate the HEC-RAS 4449 model parameters. Windows-only.

### FEMA 480 — Floodplain Management Study Guide for Local Officials
**File:** `fema-480-floodplain-management-study-guide.pdf` (10 MB)

Comprehensive guide to floodplain management for local officials. Covers NFIP requirements, floodplain regulations, and community responsibilities.

**TSM relevance:** Reference for Posey County officials and the TSM community outreach work.

## Not Included

- **CHAMP 2.0 Manual** — Coastal Hazard Analysis Modeling Program. Coastal-only, not relevant to Ohio River inland flooding.
