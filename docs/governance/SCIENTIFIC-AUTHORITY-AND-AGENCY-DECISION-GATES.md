# TSM scientific authority and government decision gates

**Status:** Implementation contract and research record, 2026-11-09. **Not an agency approval, licensed survey, legal opinion, or certified hydraulic model.**

## Core rule

TSM can make evidence **reproducible, independently testable and reviewable**; it cannot become the statutory issuer of a FEMA map revision, professional engineering seal, cadastral boundary decision, permit, or professional license. Government *source of record* status is scoped to the agency's product and its effective date, **not** automatically transferred to a downstream calculation. In particular, a source checksum does not prove the source's correctness, a software test does not prove a calibrated model, and a decision-document checksum does not authenticate an issuer.

A claim must retain five independent dimensions:

1. **Source authority:** issuing agency, product ID, original URI, exact retrieval bytes SHA-256, publication/effective date, coverage, product limitations and license.
2. **Geodetic and measurement quality:** horizontal CRS, epoch, vertical datum, geoid model, physical units, control/checkpoint methodology, quantified uncertainty, completeness and resolution. Preserve the original units and convert only via explicit versioned transforms.
3. **Numerical evidence:** solver/version, immutable input/output hashes, solver run status, convergence, conservation, independent benchmark comparison, sensitivity/uncertainty and a reproducible execution environment.
4. **Professional accountability:** reviewer identity, jurisdiction, current license and scope, seal/signature where legally required, and verified independent review evidence. The application cannot issue a license or professional seal.
5. **Agency decision:** official case ID, authorized issuer, legal instrument type, scope, issue/effective dates, source document, case-registry lookup, signature or equivalent official authenticity verification and any limitations/conditions. A CLOMR is conditional, not a final LOMR.

## Current automated enforcement

- `backend/engineering_evidence.py` — hashes actual solver artifacts and maintains a local append-only ledger; evidence verification is not agency approval.
- `backend/hydrologic_coupling_acceptance.py` — three-solver contract (HEC-RAS, MODFLOW 6, EPA SWMM), mass-balance and benchmark thresholds, explicit exchange CRS/vertical datum/units/time step; fixtures are synthetic, not calibration.
- `backend/regulatory_authority_boundary.py` — rejects self-declared regulatory approval, missing lineage and incomplete technical check declarations, invalid timestamps, nonfinite uncertainty, altered decision files and scenario-as-regulatory assertions. Even if a decision document matches a digest, the result remains **DECISION_DOCUMENT_PRESENT_AWAITING_ISSUER_CONFIRMATION**, not approved.
- `scripts/geospatial/recover_posey_missing_building_candidates.py` — fetches only the 267 archived source IDs from the official Indiana service and writes candidates with regulatoryUse=false; never silently merges current OBJECTIDs into the archived source.
- CI: `hydrologic-coupling-evidence.yml`, `regulatory-authority-boundary.yml`, `posey-official-building-candidates.yml` execute contract tests; external official service retrieval can still fail independently of local contract correctness.

**Open requirements:** live official decision verification and agency-trusted signature/key registry; independent solver calibration; external model benchmarks; all Posey footprints reconciled by archived geometry/vintage and heights; survey control; jurisdiction-specific professional review; regulatory decision records; native offline release builds and comprehensive CI. No test fixture or this document satisfies those requirements.

## Authority-specific source and law registry (research, not legal certification)

| Jurisdiction / field | Official source | Boundary |
|---|---|---|
| FEMA effective flood maps | https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer | Verify effective panel, revision date, flood study and case-specific map amendments. |
| FEMA map revisions | https://www.ecfr.gov/current/title-44/part-65 and https://www.fema.gov/flood-maps/change-your-flood-zone/lomr-clomr | 44 CFR Part 65 requires supporting hydrologic/hydraulic evidence as applicable. Only FEMA's decision changes the effective map. CLOMR is a conditional comment. |
| USGS elevation | https://www.usgs.gov/ngp-standards-and-specifications/3d-elevation-program-standards-and-specifications | USGS 3DEP lidar quality and checkpoint requirements; DEM interpolation is not a legal survey monument. |
| USGS measurement traceability | https://www.nist.gov/metrology/metrological-traceability | Traceability includes an uncertainty chain; fitness for purpose remains separately assessed. |
| USACE HEC-RAS | https://www.hec.usace.army.mil/software/hec-ras/documentation/RD-52_HEC-RAS%20Verification%20and%20Validation.pdf | Solver verification/validation benchmarks do not replace project-specific calibration. |
| USGS MODFLOW 6 | https://pubs.usgs.gov/tm/06/a55/tm6a55.pdf | Inspect solver convergence, budget, conceptual model and calibration to actual groundwater observations. |
| Indiana survey | https://iar.iga.in.gov/latestArticle/865/1 | Licensed surveyor responsibility and survey evidence; verify current operative rules. |
| Indiana engineering | https://iga.in.gov/laws/2026/ic/titles/25 | Verify applicable IC 25-31 licensing, responsible charge and seal rules. |
| Illinois engineering and survey | https://www.ilga.gov/ftp/ILCS/Ch%200225/Act%200325/022503250K1.html and https://www.ilga.gov/ftp/ILCS/Ch%200225/Act%200330/022503300K5.html | Illinois 225 ILCS 325/330 licensing and scope requirements, subject to operative amendments. |
| Kentucky engineering and survey | https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=31419 | KRS 322.020 licensure requirements, with applicable statutory exceptions. |

## Release claims: permitted wording

- `SOURCE_RETRIEVED`: a source was downloaded and its bytes recorded. **Not** scientifically verified.
- `SOURCE_QA_PASSED`: specified QA checks completed with preserved evidence. **Not** necessarily fit for design.
- `MODEL_BENCHMARKED`: specific reproducible benchmark and tolerance passed. **Not** calibrated to the site.
- `SITE_ENGINEERING_REVIEWED`: independently recorded professional review under applicable rules; does not issue a government permit.
- `AGENCY_DECISION_AUTHENTICATED`: reserved for a future independently verified, case-scoped issuer registry/signature workflow. **Not currently implemented**.
- `REGULATORY_APPROVED`: never inferred from source authority, hash, passing CI, self-declared reviewer flag, or a model result; requires the actual operative agency determination for the specific purpose and geography.

## Internal-source caution

The connected Google Drive file titled **Tri-State Systems Manager Audit** (2026-10-18) discusses electronics tri-state bus arbitration, high-impedance states and alleged cyclomatic-complexity metrics. Those claims are not evidence of the geospatial/hydrologic implementation and should not be imported as verified geospatial engineering findings without independently inspecting the relevant code and methodology.

## Engineering acceptance objective

Publish a verifiable dossier per AOI and scenario: source manifests; raw data and exact versions; COGO/least-squares covariance and residuals; benchmark datasets; solver logs and mass balances; geodetic controls and checkpoint uncertainty; reviewer qualifications; a case-specific decision record; and reproducible executable environment. Show `NOT_EVIDENCED` for every missing artifact rather than inferring success.
