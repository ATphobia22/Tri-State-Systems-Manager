# Independent Engineering Acceptance — Evidence and Human Authority

**Status: technical precheck scaffolding integrated; independent physical evidence NOT yet supplied.**

A green build proves code/tests passed, **not** elevation survey-grade quality, complete county mesh topology, hydrologic calibration, no-rise certification or a permit.

## Geodesy and terrain

- Track EPSG:2966 horizontal metadata, source axis/units, NAVD88 vertical reference, acquisition vintage, LAS/DEM quality level, checkpoint report and all source SHA-256s. GNSS ellipsoid heights require compatible NAD83(2011) + GEOID18 transformation, not an undocumented WGS84 or EGM2008 geoid substitution.
- A qualified surveyor must supply **independent, source-backed checkpoints** with identified observation methods, control-survey records, and representative geographic/land-cover coverage. An initial quality-level RMSEz expectation is not a claim that an individual DEM met it.
- Predeclare accuracy limits and test measured DEM minus surveyed NAVD88 heights in meters. Compute RMSEz and record bias, vegetated/non-vegetated class, slope, n, independence and coverage separately in the full professional report. Treat checkpoint counts and acceptance criteria from the current adopted USGS LBS and ASPRS standard; do not invent a universal minimum from this software.
- Existing regional 3DEP elevation supports *screening*, not automatic site/cut-fill/berm design.

Authoritative references:
- USGS 3DEP quality levels: https://www.usgs.gov/3d-elevation-program/topographic-data-quality-levels-qls
- USGS 3DEP standards: https://www.usgs.gov/ngp-standards-and-specifications/3d-elevation-program-standards-and-specifications
- NGS GEOID18: https://geodesy.noaa.gov/GEOID/GEOID18/
- NGS datum reference: https://geodesy.noaa.gov/datums/vertical/index.shtml

## County-wide seam and 3D geometry

- A 400 km² pilot, or 17,162 previously checked seam intersections, is **not full-county proof**.
- Inventory *every* DEM/geometry tile intersecting the official Posey County AOI, compute tile/coverage hashes, and verify all internal adjacency pairs, all external closure edges and every change-of-LOD transition.
- Record triangle integrity, zero uncovered tiles, zero true cracks, zero non-manifold edges, no invalid geometry, measured max gap and a predeclared positional tolerance. Validate source DEM coverage, coordinate transforms, memory/streaming behavior, and reproducible generated mesh hashes.
- Production `Transvoxel` acceptance requires complete reproducible county output, a mesh validator and real DEM evidence. Passing synthetic code tests is a narrower result.

## Regulatory floodway analysis

- FEMA federal adopted floodway **no-rise** requires no positive increase in flood stage under the regulated base-flood analysis; **zero** is not interchangeable with a 0.15-foot Indiana rule.
- 312 IAC 10-2-3 specifies a separate Indiana definition referring to a 0.15-foot threshold, with enumerated exceptions. Local ordinances, mapped floodway and permit scope must be checked by appropriate authorities.
- Preserve effective FIRM/FIS panel vintage, regulatory floodway/cross sections, base and encroached conditions, model input/output hashes, model version, datum/gage reference, calibration, uncertainty, engineer's written review and floodplain administrator acknowledgment.
- Never issue automatic `no-rise`, `LOMA`, `CLOMR`, `LOMR`, construction permit, floodproofing or design certification. Only qualified signatories and agencies hold those authorities.

References:
- FEMA floodway guidance: https://www.fema.gov/sites/default/files/documents/fema_rm-floodway-analysis-and-mapping-nov-2023.pdf
- Indiana DNR: https://www.in.gov/dnr/water/regulatory-permit-programs/exemptions/

## Machine-checkable precheck

```bash
python -m unittest scripts.engineering.test_independent_acceptance_gate -v
python scripts/engineering/independent_acceptance_gate.py \
  --evidence data/engineering/independent-acceptance-pending-v1.json \
  --output artifacts/independent-acceptance-precheck.json
```

This committed record is intentionally incomplete: no source measurements, mesh proof or regulatory approvals are fabricated. **A future populated manifest is a consistency precheck, never legal or professional certification**. Full release promotion requires independent signed reports, explicit reviewing authorities, artifact signatures and complete source data.

**Safety contract:** technology informs; humans retain final authority. Public read access stays anonymous, and sensitive residential AOI records should be separately reviewed for public publication.
