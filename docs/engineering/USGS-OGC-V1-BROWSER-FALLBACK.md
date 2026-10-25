# USGS OGC v1 browser fallback — observation correctness

## Scope

The browser-only `fetchUsgsLatestContinuous` function is a **read-only, user-triggered fallback**, not a verified hydraulic-model input, background polling service, or station-datum converter. Prefer the TSM `/api/hydrologic/*` server plane.

## Preconditions enforced

- USGS station IDs must contain exactly eight decimal digits; requested parameter codes are explicitly limited to **00065** (gage height) and **00060** (discharge).
- URL construction is restricted to the modern documented `api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items` endpoint.
- Every returned feature must match the exact requested `monitoring_location_id` and a requested parameter code.
- Only genuine finite numeric readings are accepted. `null`, empty strings, booleans, `NaN`, `Infinity`, and sentinel values (`-999`, `-9999`, `-8888`) are rejected. Numeric **zero** remains valid.
- Each observation must provide a parseable timestamp with an explicit time-zone suffix and a nonblank unit. No fallback to retrieval time is permitted.
- For `00065`, `verticalDatum = GAGE_DATUM` and does **not** imply NAVD88. For `00060` discharge, the vertical datum is **null**.
- If no usable features remain, callers receive an explicit error; the UI must render unavailable rather than invent readings.
- The fetch is bounded by a validated timeout; no timer that polls or refreshes observations is added.

## Verification

```sh
cd tsm-console
node --experimental-strip-types --test tests/usgs-direct-validation.test.mjs
```

The existing console `test:all` command includes the new `.test.mjs` file and runs on the TSM Parse Gate workflow. These are synthetic **parsing fixtures**, not live-gauge calibration or proof of continuous availability. A release must also verify current source terms/endpoint metadata, actual retrieval receipts, freshness status, and data provenance.

## Official source

[USGS Water Data APIs: migrating to OGC v1](https://api.waterdata.usgs.gov/docs/ogcapi/migration/).

No automated monitoring, NAVD88 conversion, flood-inundation certification, or regulatory determination is authorized by this patch.
