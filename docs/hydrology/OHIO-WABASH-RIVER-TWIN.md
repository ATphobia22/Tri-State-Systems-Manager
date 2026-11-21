# Ohio–Wabash river twin pilot

This pilot captures USGS continuous gauge-height evidence for the Ohio River at Evansville (`03322000`) and Wabash River at New Harmony (`03378500`). The connected publication workflow collects overlapping six-hour windows every three hours after activation on the default branch. Each run yields a distinct downloadable GitHub Actions artifact with the original GeoJSON, request URLs, time window, station status, and SHA-256 hashes. Actions retains these artifacts for 30 days. Download the snapshots you intend to keep or replay.

The workflow flags missing evidence and uploads the available stations. API pagination, a missing response, or an unavailable station cannot create model elevation or fill a gap in the record. Overlapping snapshots may contain provisional and revised versions of observations. Use the archived response associated with the review window for reproducible comparisons.

## Capture and replay

From the repository root with Python 3.12, capture to a new directory. For a historical event, supply the end of the six-hour UTC window.

```sh
python scripts/hydrology/river_twin_snapshot.py capture river-snapshot
python scripts/hydrology/river_twin_snapshot.py capture historical-snapshot --end 2025-04-10T18:00:00Z
python scripts/hydrology/river_twin_snapshot.py compare river-snapshot review.json comparison.json
python -m unittest discover -s tests -p test_river_twin_snapshot.py -v
```

The comparison command runs offline from a downloaded snapshot. It requires a human-reviewed HEC-RAS extraction and a station-specific gage-zero reference. The review file identifies the run (`runId`), immutable project revision (`modelRevision`), and review record (`reviewReference`). Each reviewed station binding names the source time series, applicable datum period, and matching hydraulic output location. The review should record the originating HEC-RAS plan/result and the extraction procedure. Use a withheld event or independent gauge for validation and record whether the observations informed model forcing, calibration, or assimilation.

The following is a template. Fill the placeholders with reviewed records before running the comparison.

```json
{
  "schema": "tsm.river-twin.model-review.v1",
  "engine": "HEC-RAS",
  "runId": "<plan/run identifier>",
  "modelRevision": "<immutable project revision>",
  "reviewReference": "<signed review or review record>",
  "bindings": [
    {
      "stationId": "03322000",
      "timeSeriesId": "<USGS time_series_id>",
      "modelLocation": "<river/reach/cross section or 2D output location>",
      "modelDatum": "NAVD88",
      "modelUnits": "ft",
      "validFrom": "<effective timestamp with offset>",
      "validUntil": "<exclusive end timestamp with offset>",
      "gageZeroFtNavd88": null,
      "datumReference": "<published gage-zero reference applicable to the series and period>",
      "datumEvidence": "datum-evidence.pdf",
      "datumSha256": "<SHA-256 of datum evidence>",
      "modelCsv": "model-wse.csv",
      "modelSha256": "<SHA-256 of extracted model CSV>",
      "observationUse": "UNDETERMINED"
    }
  ]
}
```

The CSV uses the existing calibration reader's `time,stage` header, where this pilot interprets `stage` strictly as model water-surface elevation in feet NAVD88. Supply at least three timestamped rows. The evaluator verifies the CSV and datum evidence byte hashes. The human review establishes their provenance and applicability. Allowed observation-use declarations are `WITHHELD_DECLARED`, `MODEL_INPUT_OR_CALIBRATION`, and `UNDETERMINED`.

The comparison preserves source observation IDs and quality flags, and uses only exactly aligned approved USGS values with the declared series and applicable datum. Each pair records the observed stage, computed NAVD88 water-surface elevation, model elevation, and signed model-minus-observation residual. The output also gives pair count, bias, and mean absolute error. A comparison with no approved matches has null metrics. Results remain available for engineering review and model updates require human approval.

## Release evidence

The pilot's automatic capture and offline comparison are tested separately from hydraulic model acceptance. A production comparison requires real model results, reviewed matchup and datum records for both stations, and a held-out observation period. This job publishes observation artifacts. Regional terrain, countywide Posey building tiles, and the native Windows 11 offline Shipping package retain their release gates.
