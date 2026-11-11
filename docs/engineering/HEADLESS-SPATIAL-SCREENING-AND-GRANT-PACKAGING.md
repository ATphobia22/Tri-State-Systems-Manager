# Headless spatial-screening and evidence archive contracts

This implementation deliberately **does not claim** to run GeoPandas spatial joins, HEC-RAS, rainfall runoff, LAG surveys or hydraulic models. It consumes separately verified GIS/model inputs after a spatial join and performs a **screening-only** calculation. Unmatched flood polygons, missing BFE, incompatible vertical datum, unknown units, and unsurveyed LAG are **NOT_EVALUATED**, never safe/compliant.

Run with standard Python:

```bash
python -m unittest discover -s tests/engineering -p test_elevation_evidence_contract.py -v
python scripts/engineering/evaluate_elevation_screening.py --input structures.json --output screening.json
python scripts/engineering/package_evidence.py --source review-artifacts --output review.zip --project "Mount Vernon, Indiana"
```

Each JSON input record requires structure_id, source_sha256, source_id, crs, vertical_datum, elevation_units, lag_elevation, bfe_elevation, rule_id, freeboard_ft, plus **flood_zone_intersection=true**, **lag_source_type=surveyed_lag**, and **rule_verified=true** for threshold screening. A positive result means only that the provided LAG-to-BFE threshold calculation passed, **not** that a property satisfies FEMA, USACE, state, local or NFIP requirements. No blanket 1-ft freeboard rule is assumed. A SHA-256 string is required but the actual source file is not hashed by the evaluator; independently verify that source before marking it authoritative.

The package requires five named artifacts by default: report.pdf, compliance_results.gpkg, compliance_ledger.csv, summary_metrics.json, elevation_distribution.svg. It creates a per-artifact SHA-256 manifest, rejects symlinks, unsafe names and overwrite, and sets `REVIEW_REQUIRED_NOT_SUBMITTED`. A complete ZIP is **not** an agency-approved or grant-portal-ready submission.

**Next implementation gates:** authoritative GIS spatial joins with documented join cardinality and null handling; raster NoData and vertical transformation verification; certified/approved local rule registry; actual HEC-RAS model input/output provenance; floodway encroachment and BCA analysis; independent PDF evidence generation; headed UE5.8 streaming, GPU weather, visual layer styling, and offline Windows Shipping verification. H3 is a spatial index, not an exact quadtree or a guarantee of equal distances; native streaming must use the actual H3 v4 C API and verified ECEF-to-local coordinate conversion. Never return fabricated H3 cell IDs or mark an asset loaded until the stream has completed.
