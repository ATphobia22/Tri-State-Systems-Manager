# Offline observation analytics

DuckDB is an optional offline analysis/preprocessing store, separate from the existing SQLite/SpatiaLite native snapshot and PostgreSQL/PostGIS deployment. It adds no HTTP server, cloud database, login, or native UE runtime dependency. Automatic extension installation/loading is disabled. Operate one writer process at a time; readers open a completed immutable snapshot read-only.

```bash
python -m pip install -r tools/observations/requirements.txt
python tools/observations/store.py --db observations.duckdb ingest \
  data/fabrics/downloads/usgs-water/latest-continuous-03378500.json \
  --source-url https://api.waterdata.usgs.gov/collections/latest-continuous/items \
  --recorded-at <actual-ingestion-time-with-timezone>
python tools/observations/store.py --db observations.duckdb asof \
  --series <actual-time_series_id> --at <event-time> --known-at <knowledge-cutoff> --max-age-seconds 3600
python tools/observations/store.py --db observations.duckdb export observations.parquet
python -m unittest discover -s tests/observations -v
```

## Evidence and time rules

- Import the repository's archived USGS FeatureCollection shape; source URL is operator-supplied provenance, not independently authenticated authority.
- Hash original bytes; store stable observation ID, time-series/station/parameter identifiers, units, approval, qualifier and value. Never infer discharge or water level from other parameter codes.
- `observed_at` is event time; `sources.recorded_at` is the operator-declared ingestion/knowledge time, not proof of when an agency published a revision. Timezones required; ingestion cannot precede an observation.
- Identical byte imports are idempotent. Different source snapshots retain revisions. The latest prior event visible at the requested knowledge cutoff wins; recorded-time ties use source hash as a deterministic tie-break, not a scientific preference.
- No future-event lookahead. `SOURCE_UNAVAILABLE`, `STALE` and `LIVE_OBSERVATION` are determined relative to the caller's requested event time and age threshold, not necessarily wall-clock now. A revised null remains unavailable; older non-null values are not silently substituted.
- Preserve value/units; datum stays UNVERIFIED. Gage stage is never relabeled NAVD88 WSE, and no cross-unit/datum aggregation is performed.
- Reject malformed/nonfinite values and duplicate IDs before transaction commit. Parquet export retains both source and timing metadata, refuses overwrite, and emits a SHA-256 receipt. Binary files are generated locally, not committed.

## Dataset verification

Smoke-tested the repository's `data/fabrics/downloads/usgs-water/latest-continuous-03378500.json` (SHA-256 `92235717615c4d85c105c7ceb6947038b37f2c51c15b8a82065ea29ce9584d5b`): five archived observations, imported and exported to Parquet. This is an old snapshot, not a new USGS acquisition or current river reading. All five fixture tests pass, including knowledge-cutoff exclusion, stale/future handling, revision/null preservation, idempotence, rejection and Parquet round trip.

## Database research and scope

- DuckDB official ASOF semantics: https://duckdb.org/docs/2.0/guides/sql_features/asof_join
- Parquet support: https://duckdb.org/docs/2.0/data/parquet/overview
- Concurrency: https://duckdb.org/docs/2.0/connect/concurrency
- TimeDB is an older bitemporal SQL/ATSQL2 system (Java/JDBC in version 2), not another name for TimescaleDB: https://timeconsult.com/Software/AboutTimeDB1.0.html and https://www.timeconsult.com/Software/Software.html . No unsupported package called `timedb` is installed.
- Existing TSM decision: `docs/EXECUTIVE-REVIEW-VERIFICATION.md` and `docs/engineering/scientific-integration-registry.md` already describe TimescaleDB as optional/unsupported without a demonstrated workload need. No TimescaleDB extension or migration is deployed here.

USGS field evidence and native release acceptance remain independent gates. A successfully queried database does not establish a calibrated model, validated vertical datum, native Shipping binary or regulatory determination.
