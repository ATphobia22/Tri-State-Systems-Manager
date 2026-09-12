# Government Operational Twin Hardening Plan — 2026-09-12

## Objective
Prepare `main` for operational showcase, engineering peer review, and government-oriented evidence review of the Open World Tri-State River Valley Engineering Sim without overstating regulatory approval or replacing human authority.

## Scope
1. Audit repository architecture, source registry, runtime loaders, geospatial twin, HEC-RAS evidence, CI/CD, security, provenance, and documentation.
2. Wire authoritative real-time sources: NOAA NWPS observed data first, USGS Water Data fallback; preserve provisional qualifiers and timestamps.
3. Wire real geospatial sources: Indiana Current Imagery, FEMA NFHL, Indiana BAFM, USGS 3DEP/TNM terrain pipeline.
4. Keep FEMA NFHL and Indiana BAFM explicitly separate in data, UI, authority labels, and documentation.
5. Correct MapLibre ArcGIS ImageServer consumption so the current imagery service uses supported `exportImage` requests rather than assuming cached tiles.
6. Preserve configurable local Terrain-RGB/PMTiles/Martin deployment; never fabricate terrain data when the runtime terrain endpoint is absent.
7. Formalize HEC-RAS 2D mesh targets, breaklines, sub-grid property requirements, boundary-condition provenance, EvidenceArtifact hashing, and human-review gating.
8. Add/strengthen machine-readable government peer-review and operational-readiness contracts, including source provenance, CRS/datum, freshness, authority class, limitations, and change control.
9. Remove stale/mock/synthetic production-path assumptions where identified; preserve explicit demo labeling for simulation/model outputs.
10. Validate through GitHub Actions and authoritative endpoint checks; report any controls that require external agency authorization, production credentials, infrastructure, or human sign-off rather than claiming compliance by code alone.

## TDD / Verification Order
- Add regression tests/contracts before implementation changes.
- Implement runtime/source changes.
- Run repository CI through GitHub Actions.
- Inspect failed jobs and correct issues.
- Re-run affected workflows until green where technically possible.
- Review final `main` tree and recent commit history.

## Government-review boundary
The repository can implement traceability, provenance, data separation, access controls, testing, records, and evidence packaging. It cannot self-certify FEMA/USACE/IDNR regulatory approval, engineering licensure, floodplain ordinance adoption, procurement authorization, or agency acceptance. Such items remain explicitly marked as human/agency authority decisions.

## Medical boundary
No medical/clinical/PHI/healthcare subsystem work is included. Clinical functionality remains in TMRDS and outside TSM's public evidence/visualization plane.
