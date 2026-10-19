# TSM technical acceptance gates

This document describes the technical contracts for datum conversion and HEC-RAS release readiness. It is independent of the project's personal memorial dedication.

## StationDatumVerifier

`tsm-console/src/lib/geodetic/station-datum-verifier.ts` checks station identity, source product and parameter, HTTPS source reference, gage-zero units and target datum, timestamp, explicit confirmation of the station/product relationship, and SHA-256 integrity of supplied source-document text.

A successful contract check means the supplied evidence is internally consistent; it does not independently authenticate a source agency publication. The upstream source-acquisition and review workflow must establish that authenticity. If evidence is absent, TSM reports `unavailable` and keeps the stage in `GAGE_DATUM`; inconsistent evidence is `invalid`. It does not guess a gauge zero.

For ellipsoid-to-orthometric conversion, the documented GEOID18 relationship is (H = h - N), with compatible horizontal frame/epoch and a genuine NGS grid required for operational conversion. The static Posey AOI sample panel is educational and is not a substitute for grid interpolation.

## HECReleaseGateChecker

`tsm-console/src/lib/hec-release-gates.ts` emits four independently inspectable technical gates:

1. **AOI/watershed boundary:** identifiers, CRS, positive area, source URI, topology/intersection result, and SHA-256 of the supplied GeoJSON text.
2. **DEM provenance:** source, acquisition date, resolution, horizontal CRS, NAVD88 vertical datum, vertical units, and a SHA-256 checksum recomputed over the supplied raster bytes.
3. **Vertical datum:** source/target datum consistency and named transformation evidence when a conversion is claimed.
4. **Solver evidence:** solver name/version and SHA-256 verification of the supplied input manifest and output artifact text.

The checker returns `ready-for-engineering-review`, `incomplete`, or `blocked`. A green technical report is **not** a HEC-RAS run, a sealed engineering report, an agency approval, a regulatory determination, or professional certification. **A PE license is not a prerequisite for TSM software to run its technical workflows.** If a particular deliverable or intended use requires a PE under applicable law, contract, or agency rules, that professional review is a separate workflow and is not a blanket runtime gate. TSM does not claim that correct calculations alone confer authority to certify or submit regulated engineering deliverables.

## Runtime behavior

Missing upstream services or datasets should produce explicit unavailable/degraded states scoped to the affected operation. Invalid evidence, hash mismatches, datum conflicts, or contradictory boundaries block the affected release gate. This is technical input validation, not a charter-based governance mechanism.
