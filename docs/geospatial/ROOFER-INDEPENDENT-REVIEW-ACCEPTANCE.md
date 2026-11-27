# Independent Roofer review acceptance (non-promoting)

The existing Mount Vernon PDAL/Roofer pilot uses experimental class-1 returns. Its outputs and the independent audit remain review-only. No geometry or successful command exit from this path authorizes CityGML/CityJSON production import, engineering use, or publication.

## Operator procedure

Install the existing `auto-3d-city-builder[test]` package and its pinned native runtime in an isolated environment. Provision the reviewed val3dity 2.7.0 executable from the official TU Delft release (including its dependencies) and obtain its SHA-256 from a separately trusted release/installation record. Do not derive a trust pin from an untrusted candidate bundle.

```bash
python -m citybuilder.review_acceptance reviewed reconstruction-review \
  --val3dity /absolute/path/to/val3dity \
  --validator-sha256 "$TSM_TRUSTED_VAL3DITY_SHA256"
```

Run before deleting raw COPC or metric LAS files. The existing uploaded Roofer review artifact excludes both, so that archive alone is intentionally insufficient. A missing file, unsupported runtime, invalid CRS, source digest mismatch, malformed report or zero candidates produces a nonzero exit. The audit reopens actual raw point headers, metric and raster products, reconciles every source ID, checks CityJSONSeq hashes and validates only the structural review candidates with the separately pinned val3dity CLI. No database is contacted.

The independent report validates the geometry only of the selected candidate subset. Source license review, independent survey/geodetic checkpoints, full lineage authentication/replay, time reconciliation, CityGML/3DCityDB round-trip and Human Authority Final remain mandatory. Review receipts and candidate hashes are not signed attestations. A full valid solid does not establish spatial accuracy. The audit is deliberately constrained to the pinned pilot; it is not a generic countywide acceptance service.

## Test command

```bash
python -m pip install -e 'scripts/geospatial/auto-3d-city-builder[test]'
python -m pytest scripts/geospatial/auto-3d-city-builder/tests/test_review_acceptance.py -q
```

Unit tests use explicitly synthetic bytes and substituted LAS/validator calls for failure paths, plus actual temporary GeoTIFF CRS/unit checks. They do not establish measured-building acceptance or native val3dity performance. See the official report contract: https://val3dity.readthedocs.io/2.7.0/usage/.
