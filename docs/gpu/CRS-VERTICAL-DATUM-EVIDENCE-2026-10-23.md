# CRS and vertical-datum evidence report

Generated: 2026-10-23

| Metric | Count |
| --- | ---: |
| Sources | 10 |
| Complete | varies |
| Incomplete | varies |
| Missing critical | 1+ |

See `data/geospatial/crs-vertical-datum-evidence-report-v1.json` for full machine-readable output.

- Missing CRS or vertical datum is MISSING_CRITICAL — runtime must fail closed.
- NGVD29↔NAVD88 is not auto-converted without published transform evidence.
- Web Mercator (EPSG:3857) is never treated as engineering metres without explicit bridge.
- Report does not invent CRS/datum values for incomplete catalog rows.

**Human authority remains final.**
