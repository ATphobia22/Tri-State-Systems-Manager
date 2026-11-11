# USGS WaterServices retirement: TSM hydrology adapter update — 2026-11-11

USGS official notice: the legacy `waterservices.usgs.gov` API family is scheduled for decommissioning in the first quarter of 2027. See:

- https://www.usgs.gov/tools/usgs-water-data-apis
- https://api.waterdata.usgs.gov/docs/ogcapi/migration/
- https://api.waterdata.usgs.gov/docs/ogcapi/

## Implemented

The standalone, user-invoked `packages/hydrology/src/usgs-stage-adapter.mjs` now consumes:

```text
https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items
  ?f=json
  &monitoring_location_id=USGS-<reviewed-id>
  &parameter_code=00065
  &limit=100
```

The station ID allowlist, optional test fetch injection, source-body SHA-256, and stage-only/never-NAVD88 contract remain intact. The adapter rejects invalid/missing/no-data values, foreign stations and parameters, wrong units, future timestamps, malformed OGC records and oversized responses. Observations older than two hours are labeled `STALE`. A genuine numeric zero remains valid if present in an otherwise valid source record. This does **not** assert that a two-hour-old observation has any particular flood-risk meaning or legal effect.

The primary TSM server ingest module (`tsm-console/server/ingestion/usgs-nwis.mjs`) was **already** using the modern API; this change closes another, separate legacy stage path.

## Not migrated by this PR

The separate `packages/government/src/adapters/NwisAdapter.ts` retains the old endpoint and its legacy contract/snapshot tests. Before 2027, review every active consumer and replace live NWIS calls with the existing `UsgsOgcV1Adapter`. Keep historical fixtures in a replay/compatibility module rather than silently rewriting their URLs, units or hashes. Service metadata and geodetic datum evidence must be captured as actual published station metadata.

No automatic observed gage-height-to-NAVD88 elevation conversion is authorized without station-specific gage-zero evidence and verified site-transfer logic. NOAA NWPS observation and forecast output also remain separate source classes.

## Acceptance

Run `node --test tests/contracts/usgs-stage-adapter.test.mjs` and the pinned `Modern USGS OGC Stage Source Contract` workflow. Tests use local synthetic responses, not real-time agency availability. Production source health requires independent live API checks and a dated receipt. Human Authority Final; no engineering or regulatory approval is inferred.
