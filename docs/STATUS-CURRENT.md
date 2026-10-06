# TSM Current Release Status

**Status date:** 2026-10-06  
**Repository:** ATphobia22/Tri-State-Systems-Manager  
**Branch:** `main`

## Release gate

The project remains **fail-closed** until the following gates are green:

1. npm dependency audit with no HIGH/CRITICAL vulnerabilities.
2. Government operational contract tests.
3. FEMA NFHL missing-source recovery.
4. Exact spatial validation and SHA-256 recovery manifest.
5. Production Pages build and public-site verification.
6. Native/offline/security gates.

## Active remediation (2026-10-06)

- `source-map-js` HIGH vulnerability resolved via npm override to `^1.2.2`; lockfile and SBOM regenerated; dependency-integrity check passes.
- Live stage telemetry is **button-only** per the standing owner rule (2026-10-01, superseding): page loaders return the unavailable sentinel and perform no network fetch. The only live path is an explicit "Fetch live snapshot" button press — no polling, no background refresh, provisional USGS qualifiers, fail-closed site transfer.
- FEMA NFHL recovery resolves the effective **Flood Hazard Zones** layer by semantic discovery (service metadata + field contract) instead of a hardcoded layer ID, against FEMA's documented `/arcgis/rest/services/public/NFHL/MapServer` endpoint.
- README, owner-action document, and verification references synchronized with actual repository state.

## Intentionally owner/authority dependent

The following are not to be fabricated by code:

- authoritative project/site coordinate;
- FEMA Community ID and FIRM panel reconciliation;
- BCA Toolkit export;
- PE-sealed/final no-rise filing and agency receipt;
- remaining station-specific NAVD88 gage-zero relationships;
- local Hazus calibration;
- SCS/USGS event validation;
- Apple Developer signing identity and signed iOS artifact.

## Engineering boundary

TSM is a community engineering decision-support and evidence platform. It does not certify engineering work, replace licensed professionals, or convert provisional observations into regulatory determinations.

## Release rule

A green release requires evidence from the actual workflow runs. Documentation must never declare a green state solely because the expected fixes have been committed.
