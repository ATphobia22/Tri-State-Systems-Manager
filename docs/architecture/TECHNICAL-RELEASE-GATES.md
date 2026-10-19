# TSM technical acceptance gates

This document describes the technical contracts for datum conversion and HEC-RAS release readiness. It is independent of the project's personal memorial dedication.

## StationDatumVerifier

`tsm-console/src/lib/geodetic/station-datum-verifier.ts` checks station identity, source product and parameter, HTTPS source reference, gage-zero units and target datum, timestamp, explicit confirmation of the station/product relationship, and SHA-256 integrity of supplied source-document text.

A successful contract check means the supplied evidence is internally consistent; it does not independently authenticate a source agency publication. The upstream source-acquisition and review workflow must establish that authenticity. If evidence is absent, TSM reports `unavailable` and keeps the stage in `GAGE_DATUM`; inconsistent evidence is `invalid`. It does not guess a gauge zero.

For ellipsoid-to-orthometric conversion, the documented GEOID18 relationship is (H = h - N), with compatible horizontal frame/epoch and a genuine NGS grid required for operational conversion. The static Posey AOI sample panel is educational and is not a substitute for grid interpolation.

## HECReleaseGateChecker

`tsm-console/src/lib/hec-release-gates.ts` emits five independently inspectable gates:

1. **AOI/watershed boundary:** identifiers, CRS, positive area, source URI, topology/intersection result, and SHA-256 of the supplied GeoJSON text.
2. **DEM provenance:** source, acquisition date, resolution, horizontal CRS, NAVD88 vertical datum, vertical units, and a SHA-256 checksum recomputed over the supplied raster bytes.
3. **Vertical datum:** source/target datum consistency and named transformation evidence when a conversion is claimed.
4. **Solver evidence:** solver name/version and SHA-256 verification of the supplied input manifest and output artifact text.
5. **PE sign-off:** license number, jurisdiction, discipline, timestamp, signed-artifact checksum, and external license-verification evidence.

The checker returns `ready-for-engineering-review`, `incomplete`, or `blocked`. A green technical report is **not** a HEC-RAS run, a verified license-registry query, a sealed engineering report, an agency approval, or a regulatory determination. The PE license registry status is supplied evidence and must be verified by the acquisition/review workflow; the checker does not claim to contact a licensing board.

## Runtime behavior

Missing upstream services or datasets should produce explicit unavailable/degraded states scoped to the affected operation. Invalid evidence, hash mismatches, datum conflicts, or contradictory boundaries block the affected release gate. This is technical input validation, not a charter-based governance mechanism.
