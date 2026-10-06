# Drive Manifest — TSM/PTDT Google Drive collection

Inventory date: 2026-09-25 · Unique files: 145 · Ingested into repo: 26 docs + 1 test

Consolidated inventory of the owner's Google Drive Tri-State Systems Manager / Point Township
Digital Twin collection, with per-asset verification status and repo disposition.

## Status legend

| Status | Meaning |
|---|---|
| **VERIFIED** | Matches implemented, tested code in this repo |
| **ACTIONABLE** | Concrete artifact applied to the repo (migration, test, checklist, data) |
| **REFERENCE** | Working document ingested as reference; assertions NOT independently verified |
| **DESIGN-INTENT** | Aspirational/design-archive material. Explicitly NOT a spec — see banner on each file |
| **REFERENCE-ONLY** | Cataloged here; not ingested into the repo |
| — | Not applicable (binary/folder noted by location only) |

## A. Assets read in full

These were pulled from Drive, read, and individually assessed. Disposition follows each entry.

### TSM / PTDT architecture (design-intent)

- **Tri-State Systems Manager - Sovereign Public-Interest Orchestration Platform** (gdoc, 2026-08-19) — single-file HTML dashboard mockup (Tailwind CDN). DESIGN-INTENT → `docs/archive/drive-import/tsm-sovereign-public-interest-orchestration-platform.md`.
- **Tri-State Systems Manager - Sovereign Master Cockpit PTDT-V35** (gdoc, 2026-08-21; 2 older dupes) — single-file HTML/Three.js cockpit mockup with hardcoded gauge values. DESIGN-INTENT → `docs/archive/drive-import/tsm-sovereign-master-cockpit-ptdt-v35.md`.
- **Technical Briefing: PTDT v35 Sovereign Engineering System** (gdoc, 2026-08-19) — HTML briefing incl. C++ code samples (key material is `...` placeholders — no real secrets). DESIGN-INTENT → `docs/archive/drive-import/ptdt-v35-technical-briefing.md`.
- **PTDT v32/33 Sovereign Engineering Workspace** (gdoc, 2026-08-05) — HTML workspace mockup. DESIGN-INTENT → `docs/archive/drive-import/ptdt-v32-33-engineering-workspace.md`.
- **Tri-State Engineering 3D Simulator — PTDT v32 Sovereign Platform Specification** (pdf+docx, 2026-07-18, v1.0.0, "SARB-approved") — formal-looking spec; claims exceed implementation per docs/EXECUTIVE-REVIEW-VERIFICATION.md. DESIGN-INTENT → `docs/archive/drive-import/tri-state-engineering-3d-simulator-spec.md`.
- **Tri-State Twin all code** (gdoc, 2026-07-12) / **Tri-State Twin code raw** (gdoc, 2026-07-11) — AI-generated "master compiler" bash scaffolds. One dev-only credential (`township2026`) found and **redacted on ingest**. DESIGN-INTENT → `docs/archive/drive-import/tristate-twin-all-code.md`, `tristate-twin-code-raw.md`.
- **TriState. PY** (gdoc, 2026-08-10) — 275KB generated "master unified" Python engine narrative. DESIGN-INTENT → `docs/archive/drive-import/tristate-py-unified-engine.md`.
- **TsmWebGpuRayTracer.ts** (Drive root + folder copy, 2026-09-24) — real TS/WGSL module with honest presentation-only disclaimer, but hardcodes site elevations the repo privacy boundary de-scoped. Repo already ships the canonical `tsm-console/src/gpu/open-world-raytracer.ts`. DESIGN-INTENT (superseded variant) → `docs/archive/drive-import/tsm-webgpu-raytracer-drive-variant.md`.

### Engineering artifacts (actionable / reference)

- **tests_test_hec_ras_pipeline.py** (py, 2026-08-16) — self-contained pytest suite for the HEC-RAS HDF WSE→mm pipeline with synthetic fixtures. **Validated 4/4 passing** in isolation. ACTIONABLE → `backend/tests/test_hec_ras_hdf_pipeline.py` (provenance header added).
- **V35__subsurface_layers.sql sketch** (gdoc, 2026-09-18) — proposes `tsm_subsurface_boreholes`/`tsm_soil_layers` (imperial). The repo already carries the canonical `db/migrations/V35__subsurface_layers.sql` (metric, EPSG:2966/NAVD88 checks). **Not applied** — would conflict. DESIGN-INTENT (superseded variant) → `docs/archive/drive-import/v35-subsurface-layers-drive-variant.md`.
- **Technical Evaluation of Hydraulic Analysis Methodologies** (gdoc, 2026-07-17) — methodology alignment note. DESIGN-INTENT → `docs/archive/drive-import/hecras-fema-methodology-evaluation.md`.
- **Drive folder code files** (`archimedes_engine.py`, `HumanSignGatePanel.tsx`) — both **superseded by newer repo versions** (`backend/governance/archimedes_engine.py` has refined, source-dated rule thresholds; `tsm-console/src/components/HumanSignGatePanel.tsx` is auth-integrated). Not applied; noted here.

### Regulatory / grant working documents (reference)

- **LOMA Package Checklist** (pdf, 2026-07-28) — phased submission checklist. REFERENCE → `docs/regulatory/loma/loma-package-checklist.md`.
- **FEMA Form 81-92 (MT-1) field mapping** (gdoc, 2026-09-21) — draft Section A/B mapping block citing Application ID 5918599025038 / Case 26-05-2022A. REFERENCE → `docs/regulatory/loma/fema-mt1-form-81-92-field-mapping.md`.
- **PE Transmittal & LOMA Letter** (gdoc, 2026-08-21) — transmittal draft asserting Pure LOMA eligibility. REFERENCE → `docs/regulatory/loma/pe-transmittal-loma-letter.md`.
- **No-Rise Certification Package — IN-312-IAC-10** (docx, 2026-07-28) — **unfiled DRAFT template** with official-seal placeholder; not a filed certification. REFERENCE → `docs/regulatory/loma/no-rise-certification-DRAFT.md`.
- **PTDT v35 Regulatory Compliance Document Suite** (gdoc, 2026-08-18) / **Regulatory Engineering Dossier: PTDT v35** (gdoc, 2026-08-26) / **Bonebank Property: Forensic Evidence & Regulatory Submission Portfolio** (gdoc, 2026-07-19) — site-invariant compilations with unverified assertions. REFERENCE → `docs/regulatory/`.
- **FEMA BRIC FY2025 Subapplication — 13101 Bonebank Road** (docx, 2026-07-28) — subapplication narrative draft. REFERENCE → `docs/grants/bric-fy2025-subapplication-narrative.md`.
- **FEMA BRIC Grant and Data Dossier v34** (pdf, 2026-08-16) / **FEMA BCA Data Package: 13101 Bonebank Road** (gdoc, 2026-08-18) — assert BCR 2.45 / 1.41 figures (in-doc assertions, unverified). REFERENCE → `docs/grants/`.
- **Evidence Package Manifest.pdf** (2026-07-28) — JSON manifest whose checksums are **placeholders** (`e3b0c44…` = SHA-256 of empty string; `a1b2c3d4…` sequential mock). Format template only. DESIGN-INTENT → `docs/archive/drive-import/evidence-package-manifest.md` with integrity warning.
- **PTDT V35 USB edition** (gdoc, 2026-09-21) / **USB Mass Production & Deployment Guide** (gdoc, 2026-08-26) / **Point Township Flood Defense Master Plan** (gdoc, 2026-07-11) / **Regulatory Submission Summary** (gdoc, 2026-08-12) — deployment/planning narratives. DESIGN-INTENT → `docs/archive/drive-import/`.

## B. Full inventory

| Drive name | Type | Modified | Status | Disposition |
|---|---|---|---|---|
| -- Enable PostGIS extension.pdf | pdf | 2026-03-16 | REFERENCE-ONLY | cataloged; not ingested |
| -- Enable PostGIS extension.pdf | pdf | 2026-02-12 | REFERENCE-ONLY | duplicate — newest version kept |
| -- Enable PostGIS extension.pdf | pdf | 2026-01-18 | REFERENCE-ONLY | duplicate — newest version kept |
| -- Enable PostGIS extension.pdf | pdf | 2026-01-18 | REFERENCE-ONLY | duplicate — newest version kept |
| 3D Digital Twin for 13101 Bonebank Road, your production pipeline….pdf | pdf | 2026-07-18 | REFERENCE-ONLY | cataloged; not ingested |
| 3D Digital Twin Pipeline for 13101 Bonebank Road: Comprehensive Briefing | gdoc | 2026-08-12 | REFERENCE-ONLY | cataloged; not ingested |
| Arch and bca pipeline | gdoc | 2026-07-27 | REFERENCE-ONLY | cataloged; not ingested |
| Bonebank Property: Forensic Evidence & Regulatory Submission Portfolio | gdoc | 2026-07-19 | REFERENCE | ingested → `docs/regulatory/bonebank-forensic-evidence-portfolio.md` |
| Briefing Document: Tri-State Digital Twin (PTDT) and Tucker Cognitive OS | gdoc | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| Copy of Point Township Digital Twin Overview | prompt | 2026-08-05 | REFERENCE-ONLY | AI prompt artifact; not ingested |
| Copy of Point Township Revitalization | gdoc | 2025-11-30 | REFERENCE-ONLY | cataloged; not ingested |
| Copy of Point_Township_Transformation_Blueprint_V4.docx | docx | 2025-11-30 | REFERENCE-ONLY | cataloged; not ingested |
| digital twin of the Ohio wabash confluence and tri-State river valley fo… | gdoc | 2026-09-18 | REFERENCE-ONLY | cataloged; not ingested |
| do all 3 suggestions then add any or all of the information and data tha… | gdoc | 2026-09-14 | REFERENCE-ONLY | AI session transcript; not ingested |
| Do all of the following and any other suggestions to complete my system:… | gdoc | 2026-09-18 | REFERENCE-ONLY | AI session transcript; not ingested |
| Do all of the following and anything else to complete my system: constru… | gdoc | 2026-09-18 | REFERENCE-ONLY | AI session transcript; not ingested |
| do all of the following: Draft the matching React 19 MapLibre dynamic la… | gdoc | 2026-09-14 | REFERENCE-ONLY | AI session transcript; not ingested |
| Do all of the following: Generate the GitHub Actions CI/CD YAML configur… | gdoc | 2026-09-18 | REFERENCE-ONLY | AI session transcript; not ingested |
| docs/ptdt-v34/FEMA_BRIC_GRANT_AND_DATA_DOSSIER_VER... | gdoc | 2026-08-15 | REFERENCE-ONLY | cataloged; not ingested |
| docs/ptdt-v34/MASTER_COMPLETE_CODE_COMPENDIUM.md | gdoc | 2026-08-16 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_FINAL_WIRED_REPOSITORY.md | gdoc | 2026-08-16 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_GOVERNMENT_SUBMISSION_AND_SYS... | gdoc | 2026-08-15 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_REPOSITORY_AND_COMPONENT_COMP... | gdoc | 2026-08-15 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_SOVEREIGN_GOVERNMENT_COMPENDI... | gdoc | 2026-08-15 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_SYSTEM_SPECIFICATION_V34.md | gdoc | 2026-08-15 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_UNIFIED_COMPENDIUM_ALL_VERSIO... | gdoc | 2026-08-15 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_USACE_FEDERATION_PIPELINE.md | gdoc | 2026-08-17 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/MASTER_WEB_SOURCES_AND_VERSIONS_SPEC... | gdoc | 2026-08-15 | REFERENCE-ONLY | master compendium draft; not ingested |
| docs/ptdt-v34/QG04_AND_VRAM_BUDGETS.md | gdoc | 2026-08-15 | REFERENCE-ONLY | cataloged; not ingested |
| Evidence code | gdoc | 2026-07-27 | REFERENCE-ONLY | cataloged; not ingested |
| Evidence Package Manifest.pdf | pdf | 2026-07-28 | DESIGN-INTENT | ingested → `docs/archive/drive-import/evidence-package-manifest.md` |
| Evidence seal | gdoc | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| Evidence seal.pdf | pdf | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA BCA | gdoc | 2026-07-27 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA Benefit-Cost Analysis (BCA) Data Package: 13101 Bonebank Road | gdoc | 2026-08-18 | REFERENCE | ingested → `docs/grants/bca-data-package-bonebank-road.md` |
| FEMA Benefit-Cost Analysis (BCA) Data Package: 13101 Bonebank Road | gdoc | 2026-08-18 | REFERENCE | ingested → `docs/grants/bca-data-package-bonebank-road.md` (older duplicate; newest version ingested) |
| FEMA BRIC 2026 SHA-256 Sealing Protocol | gdoc | 2026-08-15 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA BRIC 2026 SHA-256 Sealing Protocol.pdf | pdf | 2026-08-16 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA BRIC FY2025 Subapplication — 13101 Bonebank Road Point Township Res… | docx | 2026-07-28 | REFERENCE | ingested → `docs/grants/bric-fy2025-subapplication-narrative.md` |
| FEMA Evidence | gdoc | 2026-09-24 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA pipeline | gdoc | 2026-07-29 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA psd Gen | gdoc | 2026-07-27 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA toolkit data.pdf | pdf | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| FEMA_BRIC_GRANT_AND_DATA_DOSSIER_VER....pdf | pdf | 2026-08-16 | REFERENCE | ingested → `docs/grants/bric-grant-and-data-dossier-v34.md` |
| FEMA_NFHL_v3.2.kmz | kmz | 2026-07-18 | REFERENCE | NOT committed — GIS binary; Drive location noted |
| Field Operations Manual: PTDT v35 Sovereign USB Deployment & Validation | gdoc | 2026-08-27 | REFERENCE-ONLY | cataloged; not ingested |
| Field Operations Manual: PTDT v35 Sovereign USB Deployment & Validation | gdoc | 2026-08-26 | REFERENCE-ONLY | duplicate — newest version kept |
| Generate all coding for 3d  mapping layers for entire Tri-State River va… | gdoc | 2026-09-18 | REFERENCE-ONLY | AI session transcript; not ingested |
| generate the official FEMA Form 81-92 (MT-1) structural data field mappi… | gdoc | 2026-09-21 | REFERENCE | ingested → `docs/regulatory/loma/fema-mt1-form-81-92-field-mapping.md` |
| generate the SQL schema migration script (V35__subsurface_layers.sql) to… | gdoc | 2026-09-18 | DESIGN-INTENT | ingested → `docs/archive/drive-import/v35-subsurface-layers-drive-variant.md` |
| Gold Deposits in Point Township.docx | docx | 2025-11-30 | REFERENCE-ONLY | cataloged; not ingested |
| GredoDB Cross-Model Join Operators for Evidence Altar | gdoc | 2026-05-30 | REFERENCE-ONLY | cataloged; not ingested |
| Hec-Ras 2d | gdoc | 2026-07-27 | REFERENCE-ONLY | cataloged; not ingested |
| Hec-Ras and fema | gdoc | 2026-08-10 | REFERENCE-ONLY | cataloged; not ingested |
| Hec-Ras and fema.pdf | pdf | 2026-08-05 | REFERENCE-ONLY | cataloged; not ingested |
| iPhone -  Point Township Digital Twin (PTDT) v32 Sovereign Operational….… | pdf | 2026-07-18 | REFERENCE-ONLY | cataloged; not ingested |
| LOMA Package Checklist | gdoc | 2026-07-27 | REFERENCE-ONLY | cataloged; not ingested |
| LOMA Package Checklist.pdf | pdf | 2026-07-28 | REFERENCE | ingested → `docs/regulatory/loma/loma-package-checklist.md` |
| Master Operational Blueprint: The AJT Sovereign Node (Point Township) | gdoc | 2026-05-30 | REFERENCE-ONLY | cataloged; not ingested |
| Master Technical Specification: Tri-State River Valley Digital Twin — US… | gdoc | 2026-08-26 | DESIGN-INTENT | ingested → `docs/archive/drive-import/usb-mass-production-deployment-guide.md` |
| No-Rise Certification Package — IN-312-IAC-10 — 13101 Bonebank Road Poin… | docx | 2026-07-28 | REFERENCE | ingested → `docs/regulatory/loma/no-rise-certification-DRAFT.md` |
| now turn gh repo clone ATphobia22/PTDT-TriState-Unified-v33 into a bette… | gdoc | 2026-09-14 | REFERENCE-ONLY | AI session transcript; not ingested |
| PE Transmittal & LOMA Letter | gdoc | 2026-08-21 | REFERENCE | ingested → `docs/regulatory/loma/pe-transmittal-loma-letter.md` |
| Point Township \ | gdoc | 2026-07-10 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Digital Twin (PTDT) v21.0: Bleeding Edge Prototype | gdoc | 2026-07-02 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Digital Twin (PTDT) v32 Sovereign Operational Control Nod… | gdoc | 2026-08-05 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Digital Twin (PTDT) v32/33 Sovereign Engineering Workspac… | gdoc | 2026-08-05 | DESIGN-INTENT | ingested → `docs/archive/drive-import/ptdt-v32-33-engineering-workspace.md` |
| Point Township Digital Twin (PTDT) v32/33: Tri-State Sovereign Engineeri… | gdoc | 2026-08-02 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Digital Twin (PTDT) v32: Sovereign Operational Node Brief… | gdoc | 2026-08-04 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Digital Twin (PTDT) v32: Sovereign Operational Node Brief… | gdoc | 2026-08-02 | REFERENCE-ONLY | duplicate — newest version kept |
| Point Township Digital Twin Automation Orchestrator | gdoc | 2026-08-05 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Digital Twin Overview | prompt | 2026-08-05 | REFERENCE-ONLY | AI prompt artifact; not ingested |
| Point Township Flood Defense Master Plan | gdoc | 2026-07-11 | DESIGN-INTENT | ingested → `docs/archive/drive-import/point-township-flood-defense-master-plan.md` |
| Point Township Revitalization | gdoc | 2025-11-30 | REFERENCE-ONLY | duplicate — newest version kept |
| Point Township Sovereign Cinematic 3D Flood Simulation Engine | gdoc | 2026-08-20 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Sovereign Node | gdoc | 2026-05-30 | REFERENCE-ONLY | cataloged; not ingested |
| Point Township Sovereign Node: Engineering Mapping and Flood Mitigation … | gdoc | 2026-05-30 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT 33.pdf | pdf | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT Blender Vector Overlay & Shader Specification.pdf | pdf | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT Daubert Standard Admissibility Specification.pdf | pdf | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT v32 Master Documentation.pdf | pdf | 2026-08-16 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT v32 Sovereign Hydrodynamic Pipeline: Technical Briefing | gdoc | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT V33 Cinematic twin copilot | gdoc | 2026-08-12 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT v34 | gdoc | 2026-08-11 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT v35 Quantum Integration Architecture Specification | gdoc | 2026-08-20 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT v35 Regulatory Compliance Document Suite: 13101 Bonebank Road Site | gdoc | 2026-08-18 | REFERENCE | ingested → `docs/regulatory/ptdt-v35-regulatory-compliance-suite.md` |
| PTDT v35 Regulatory Compliance Document Suite: 13101 Bonebank Road Site | gdoc | 2026-08-18 | REFERENCE | ingested → `docs/regulatory/ptdt-v35-regulatory-compliance-suite.md` (older duplicate; newest version ingested) |
| PTDT v35 Sovereign Master Compendium & Public-Interest Integration Speci… | gdoc | 2026-08-20 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT V35 USB edition | gdoc | 2026-09-21 | DESIGN-INTENT | ingested → `docs/archive/drive-import/ptdt-v35-usb-edition.md` |
| PTDT V35 USB edition | gdoc | 2026-09-02 | DESIGN-INTENT | ingested → `docs/archive/drive-import/ptdt-v35-usb-edition.md` (older duplicate; newest version ingested) |
| PTDT Version23 | gdoc | 2026-07-04 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT-TriState Unified Version 33 Dashboard | gdoc | 2026-08-12 | REFERENCE-ONLY | cataloged; not ingested |
| PTDT_v35_Master_Integration_README.md | gdoc | 2026-08-16 | REFERENCE-ONLY | cataloged; not ingested |
| Regulatory Engineering Dossier: Point Township Digital Twin (PTDT) v35 | gdoc | 2026-08-26 | REFERENCE | ingested → `docs/regulatory/ptdt-v35-regulatory-engineering-dossier.md` |
| Regulatory Submission Summary: 13101 Bonebank Road Sovereign Node | gdoc | 2026-08-12 | DESIGN-INTENT | ingested → `docs/archive/drive-import/regulatory-submission-summary-bonebank.md` |
| Render my house 13101 Bonebank Road Mount Vernon I... | gdoc | 2026-07-18 | REFERENCE-ONLY | cataloged; not ingested |
| search and verify then do all of the following suggestions: SYSTEM OPERA… | gdoc | 2026-09-14 | REFERENCE-ONLY | AI session transcript; not ingested |
| Show me the mathematical and scientific backed full source code block an… | gdoc | 2026-09-18 | REFERENCE-ONLY | AI session transcript; not ingested |
| Sovereign Tri-River PTDT & Federal Ingestion Control Suite | gdoc | 2026-08-05 | REFERENCE-ONLY | cataloged; not ingested |
| Technical Briefing: Point Township Digital Twin (PTDT) v35 Sovereign Eng… | gdoc | 2026-08-19 | DESIGN-INTENT | ingested → `docs/archive/drive-import/ptdt-v35-technical-briefing.md` |
| Technical Evaluation of Hydraulic Analysis Methodologies: Version 32 Ali… | gdoc | 2026-07-17 | DESIGN-INTENT | ingested → `docs/archive/drive-import/hecras-fema-methodology-evaluation.md` |
| tests_test_hec_ras_pipeline.py | py | 2026-08-16 | ACTIONABLE | ingested → `backend/tests/test_hec_ras_hdf_pipeline.py` |
| This is architectural scope: it crosses ingestion, authoritative-source … | gdoc | 2026-09-14 | REFERENCE-ONLY | AI session transcript; not ingested |
| Three.js geospatial client viewport orchestration harness to parse the t… | gdoc | 2026-09-18 | REFERENCE-ONLY | AI session transcript; not ingested |
| Tri-State  code no references | gdoc | 2026-08-22 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State 3D  System Code Architecture Summary | gdoc | 2026-07-18 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State 3D  System Code Architecture Summary.pdf | pdf | 2026-07-18 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Engineering 3D Simulator — PTDT v32 Sovereign Platform Specifi… | docx | 2026-07-18 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tri-state-engineering-3d-simulator-spec.md` |
| Tri-State Engineering 3D Simulator — PTDT v32 Sovereign Platform Specifi… | pdf | 2026-07-18 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tri-state-engineering-3d-simulator-spec.md` |
| Tri-State Family Engineering System All Gem | gdoc | 2026-08-13 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Family Engineering System Console | gdoc | 2026-08-08 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Family Engineering System Specification | gdoc | 2026-07-27 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Family Engineering System Specification.pdf | pdf | 2026-07-28 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Family Engineering System • Complete Stable Production Node | gdoc | 2026-08-11 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Medical | gdoc | 2026-08-20 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Public Power & Hydro Sovereignty Masterplan: Defeating the Inc… | gdoc | 2026-08-18 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State River Valley Public-Interest Engineering Master Binder | gdoc | 2026-08-24 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State River Valley Public-Interest Engineering Master Binder | gdoc | 2026-08-24 | REFERENCE-ONLY | duplicate — newest version kept |
| Tri-State River Valley Public-Interest Engineering Master Binder | gdoc | 2026-08-24 | REFERENCE-ONLY | duplicate — newest version kept |
| Tri-State System Manager | folder | 2026-09-03 | — | NOT committed — contents listed in §B notes |
| Tri-State Systems Manager - Infinite Orchestration Console | gdoc | 2026-08-19 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Systems Manager - Infinite Orchestration Console v35 | gdoc | 2026-08-20 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Systems Manager - Operational Subsystems Platform | gdoc | 2026-08-19 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Systems Manager - Sovereign Master Cockpit PTDT-V35 | gdoc | 2026-08-21 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tsm-sovereign-master-cockpit-ptdt-v35.md` |
| Tri-State Systems Manager - Sovereign Master Cockpit PTDT-V35 | gdoc | 2026-08-20 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tsm-sovereign-master-cockpit-ptdt-v35.md` (older duplicate; newest version ingested) |
| Tri-State Systems Manager - Sovereign Public-Interest Orchestration Plat… | gdoc | 2026-08-19 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tsm-sovereign-public-interest-orchestration-platform.md` |
| Tri-State Systems Manager - Sovereign Twin Orchestration Console | gdoc | 2026-08-19 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Twin 1 | gdoc | 2026-07-11 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State Twin all code | gdoc | 2026-07-12 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tristate-twin-all-code.md` |
| Tri-State Twin code raw | gdoc | 2026-07-11 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tristate-twin-code-raw.md` |
| Tri-State Unified Portal & Ecosystem Dashboard | gdoc | 2026-08-21 | REFERENCE-ONLY | cataloged; not ingested |
| Tri-State-Systems-Manager-main.zip | zip | 2026-09-24 | — | NOT committed — Drive location noted only (binary archive; see folder listing in §B notes) |
| Tri-State-Systems-Manager-Multi-Installer.zip | zip | 2026-09-24 | — | NOT committed — Drive location noted only (binary archive; see folder listing in §B notes) |
| Tri-State-Systems-Manager-Multi-Installer.zip | zip | 2026-09-24 | — | NOT committed — Drive location noted only (binary archive; see folder listing in §B notes) |
| TriState. PY | gdoc | 2026-08-10 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tristate-py-unified-engine.md` |
| TsmWebGpuRayTracer.ts | texmacs | 2026-09-24 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tsm-webgpu-raytracer-drive-variant.md` |
| TsmWebGpuRayTracer.ts | texmacs | 2026-09-24 | DESIGN-INTENT | ingested → `docs/archive/drive-import/tsm-webgpu-raytracer-drive-variant.md` (older duplicate; newest version ingested) |
| Tucker Inc. 82 Ecosystem - Master Engineering Platform PTDT-V35 | gdoc | 2026-08-19 | REFERENCE-ONLY | cataloged; not ingested |
| Tucker Inc. 82 Ecosystem: Calibrated Sovereign Master Cockpit PTDT-V35 | gdoc | 2026-08-18 | REFERENCE-ONLY | cataloged; not ingested |
| TuckerInc.82 Loves the TriState | gdoc | 2026-08-19 | REFERENCE-ONLY | cataloged; not ingested |
| TuckerInc.82 Loves the TriState.pdf | pdf | 2026-08-19 | REFERENCE-ONLY | cataloged; not ingested |
| Unified Tri‑River PTDT + Tucker Cognitive OS + Governance & Legal….pdf | pdf | 2026-07-18 | REFERENCE-ONLY | cataloged; not ingested |
| v35 Technical Briefing: Sovereign Point Township Digital Twin (PTDT) Eng… | gdoc | 2026-08-18 | REFERENCE-ONLY | cataloged; not ingested |
| v35 Technical Briefing: Sovereign Point Township Digital Twin (PTDT) Eng… | gdoc | 2026-08-18 | REFERENCE-ONLY | duplicate — newest version kept |
| Your question is fair. Here is the straight answer.\n\nWhy your communit… | gdoc | 2026-09-24 | REFERENCE-ONLY | cataloged; not ingested |

### B notes — folder & archives (not committed)

- Drive folder **Tri-State System Manager** (2026-09-03) contains ~30 items incl. `Tri-State-Systems-Manager-main.zip`, `Tri-State-Systems-Manager-Multi-Installer.zip`, `TuckerInc.82--main.zip`, `TMRDS-main (1).zip`, `archimedes_engine.py`, `HumanSignGatePanel.tsx`, `TsmWebGpuRayTracer.ts`, `terrain_water_compare.wgsl`, `AuditLog_FaithLayer.json`, `quantum_cure_engine.py`, `tucker_sigil.py`, `deploy.sh`, `sovereign-node-deployment.yaml`, `docker-compose.yml`, `xcode.pdf`. Zips are release snapshots — not committed to git; code files checked were superseded variants (see §A).
- `FEMA_NFHL_v3.2.kmz` (2026-07-18) — FEMA NFHL GIS export. Binary; not committed. Superseded in-repo by the NFHL REST ingestion path (`docs/NFHL-REST-AND-USGS-WATER-TOOLS.md`).
- `-- Enable PostGIS extension.pdf` (4 copies, 2026-01/02/03) — trivial setup note; duplicates not ingested.

## C. Integrity notes (cross-document inconsistencies)

Found while reading the ingested documents. Verify against authoritative sources before any filing or reliance:

1. **FEMA Community ID disagrees across docs**: LOMA checklist cites `180194`; BRIC dossier cites `180209` (Posey County Unincorporated); MT-1 mapping cites `18129C` (FIRM panel prefix). Unresolved.
2. **FIRM panel disagrees**: `18129C0215D` (codex/BCA) vs `18129C0265C` (MT-1 mapping, LOMA checklist) vs `18129C0225D` (BRIC FY2025 narrative). Unresolved.
3. **Site coordinates disagree**: PTDT v35 codex gives centroid 37.9035, -88.0007; MT-1 mapping gives 37.845887, -88.005075. Unresolved.
4. **CRS typo**: BCA data package lists `EPSG:2967 (Indiana West)` — EPSG:2967 is Indiana *East*; Indiana West is EPSG:2966 (used everywhere else). Treat as doc error.
5. **Placeholder seals**: Evidence Package Manifest checksums are placeholders (SHA-256 of empty string; sequential mock). Not evidence of sealing.
6. **BCR figures** (1.41 engineering / 2.45 legal) are in-doc assertions without attached Toolkit export in the collection.
7. **No-Rise package is an unfiled draft** (seal placeholder, DRAFT marking) — not a filed IDNR certification.
8. **BRIC timing**: FY24–25 rounds closed Jul/Aug 2026 per repo grant calendar; no FY26 NOFO in the collection. The FY2025 narrative is a draft for a closed window — useful as template only.

## D. Applied-files index

| Repo path | Drive source | Status |
|---|---|---|
| `backend/tests/test_hec_ras_hdf_pipeline.py` | tests_test_hec_ras_pipeline.py | ACTIONABLE (4/4 validated) |
| `docs/grants/bric-fy2025-subapplication-narrative.md` | FEMA BRIC FY2025 Subapplication … .docx | REFERENCE |
| `docs/grants/bric-grant-and-data-dossier-v34.md` | FEMA_BRIC_GRANT_AND_DATA_DOSSIER_VER....pdf | REFERENCE |
| `docs/grants/bca-data-package-bonebank-road.md` | FEMA Benefit-Cost Analysis (BCA) Data Package | REFERENCE |
| `docs/regulatory/loma/loma-package-checklist.md` | LOMA Package Checklist.pdf | REFERENCE |
| `docs/regulatory/loma/fema-mt1-form-81-92-field-mapping.md` | FEMA Form 81-92 (MT-1) field mapping | REFERENCE |
| `docs/regulatory/loma/pe-transmittal-loma-letter.md` | PE Transmittal & LOMA Letter | REFERENCE |
| `docs/regulatory/loma/no-rise-certification-DRAFT.md` | No-Rise Certification Package … .docx | REFERENCE (unfiled draft) |
| `docs/regulatory/ptdt-v35-regulatory-compliance-suite.md` | PTDT v35 Regulatory Compliance Document Suite | REFERENCE |
| `docs/regulatory/ptdt-v35-regulatory-engineering-dossier.md` | Regulatory Engineering Dossier: PTDT v35 | REFERENCE |
| `docs/regulatory/bonebank-forensic-evidence-portfolio.md` | Bonebank Property: Forensic Evidence … | REFERENCE |
| `docs/archive/drive-import/` (16 files + README) | top candidates & variants | DESIGN-INTENT |

One dev-only credential found in a generated scaffold was redacted on ingest (`docs/archive/drive-import/README.md`).
Zips, KMZ, and the Drive folder were intentionally not committed — locations noted in §B.
