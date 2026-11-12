# Engineering package integration audit — 2026-11-12

Requested target directories: `packages/survey/`, `packages/cogo/`, `packages/least-squares/`, `packages/landxml/`, `packages/openmi/`, `packages/forecasting/`, `packages/release-gates/`, `packages/approval-workflows/`.

Repository code-search on `main` did **not** identify those exact directory names at the audit time. This is **not proof that equivalent functionality is absent elsewhere**: the repository already has geodesy, datum and survey tooling, hydrology/HEC adapters, an evidence ledger, CI release gates and governance rules. Adding eight empty packages would not constitute integration and could fragment authority.

Proposed extraction contracts (not claimed implemented):

| Package | Required acceptance before production integration |
|---|---|
| `survey` | Station observations, instrument units, CRS/epoch, source receipt, point IDs and datum provenance; import cannot silently assume WGS84 |
| `cogo` | Traverse inverses, intersections and circular curves; US-survey-foot versus international-foot test vectors; round-trip and degenerate cases |
| `least-squares` | Weighted adjustment, covariance, rank/condition diagnostics, residuals and robust outlier policy; independent numerical reference cases |
| `landxml` | Secure XML parser (no external entities), coordinate units, parcels/alignments/surfaces, LandXML schema versions and lossless ID provenance |
| `openmi` | Versioned exchange-item quantities, spatial and temporal support, dimensional units and coupling policy; no implicit solver interchangeability |
| `forecasting` | Explicit observed vs scenario outputs, forcing provenance, calibration/validation and confidence metadata; no fake water levels |
| `release-gates` | Independently inspectable source, test, Windows Shipping, signature, offline startup and evidence checks; fail when required artifacts absent |
| `approval-workflows` | Human authority final; signed decisions, reviewer identity, immutable evidence references and rejected automation for filings |

Implementation order: **survey → cogo/least-squares → landxml → openmi/forecasting → release-gates → approval-workflows**, but reuse the existing authority/evidence architecture rather than creating parallel incompatible systems. Do not merge an untested new scientific calculator into `main` merely to fill a directory.

Cross-county datum caution: Illinois ISGS and Kentucky KyFromAbove tiles may differ by survey year, horizontal datum realization, vertical datum and geoid. A county name, EPSG:3089 horizontal coordinate label or 2-foot grid resolution alone does not establish a compatible NAVD88 elevation. Record individual tile metadata, and require a verified transformation grid before terrain mosaicking or hydraulic computations.
