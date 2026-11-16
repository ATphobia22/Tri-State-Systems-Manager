# OpenFEMA: bounded administrative data and evidence receipts

**Source:** FEMA OpenFEMA: https://www.fema.gov/api/open  
**Dataset catalog:** https://www.fema.gov/about/openfema/data-sets  
**Official sample implementations:** https://github.com/FEMA/openfema-samples  
**Citation and reuse guidance:** https://www.fema.gov/about/openfema/terms-conditions  
**Reviewed:** 2026-11-16 (versioned endpoint catalog and official code examples).  

**Meaning:** OpenFEMA datasets report disaster-declaration, NFIP, individual/public assistance, mitigation, or grant-program administrative data. OpenFEMA **does not** provide the regulatory spatial geometry of effective FEMA FIRM/NFHL layers, determine the flood status of an individual parcel, forecast water levels, prove model calibration, or approve grant eligibility. FEMA's own descriptions caution that source data can contain administrative errors and some financial figures differ from official accounting systems. These limits propagate to any TSM visualization.

## Existing contracts and new safeguards

| Repository location | Function | Evidence boundary |
|---|---|---|
| [Current catalog](../../data/fema/openfema-catalog.json) | Versioned dataset list and deprecation metadata, including v3 NFIP policies/claims and v3 HMGP disaster summaries | The checked-in lastRefresh values are historical **catalog snapshots**, never proof of live refresh |
| [Python read-only client](../../backend/geospatial/fema/openfema_client.py) | Fixed dataset allowlist, version routing, locally constructed $top/$skip pagination, 8 MiB per-page cap, 100,000-record hard cap, raw page SHA-256 receipts, explicit PARTIAL or UNAVAILABLE | Page hashes are for **retrieved response bytes**, not independent validation of FEMA data; later FEMA mutations can change bytes |
| [Node server adapter](../../tsm-console/server/ingestion/openfema.mjs) | Allowlisted versioned entities, strict JSON response normalization, bounded paging with explicit complete/PARTIAL state and reason | Partial output must **not** be published as a complete dataset |
| [Snapshot CLI](../../scripts/government/openfema_posey_snapshot.py) | Creates a new JSON + .sha256 sidecar for Posey County disaster declarations with the exact FEMA filter and safe fields | Requires successful **complete** source retrieval; rejects off-county and unexpected fields; no NFHL polygons or personal joins |
| [CI](../../.github/workflows/openfema-evidence.yml) | Offline Python/Node fixtures and no-network integrity checks | Passing tests proves parser/pager behavior against synthetic inputs, **not** the live FEMA API or current declaration truth |
| [Existing archived Posey snapshot](../../data/fema-openfema/posey-county-disaster-declarations-v1.json) | Historical 2026-09-30 capture for retrospective comparison | Count **19 at capture**, not a claim about today's declarations |

## Version and deprecation rules

These versions reflect the [checked-in FEMA catalog](../../data/fema/openfema-catalog.json), not a claim of full live endpoint inspection. **Current recommended names** include:

| Endpoint | API version | Use |
|---|---|---|
| DisasterDeclarationsSummaries | v2 | Historic incident/designation and federal programs, by county/state |
| NfipPolicies / NfipClaims | v3 | Redacted NFIP program context. **Never match rows to people, specific houses or parcel identifiers** |
| HmaSubapplications | v2 | Administrative mitigation subapplication summaries, not a live NOFO or current grant eligibility |
| HazardMitigationGrantProgramDisasterSummaries | v3 | Disaster-scoped historical HMGP financial/program data, **not official federal accounting** |
| FimaNfipPolicies / FimaNfipClaims | v2 **deprecated** | Legacy compatibility only: do not use for new unreviewed data exports |

FEMA's [dataset discovery endpoint](https://www.fema.gov/api/open) advertises v1/v2/v3/v4 and metadata; dataset/version availability must be resolved per dataset. [FEMA's sample repository](https://github.com/FEMA/openfema-samples/tree/master/code-samples) documents the default 1,000 rows, up to 10,000 with $top, $skip paging, and $allrecords bulk export. TSM intentionally **does not** use $allrecords for its bounded runtime/CI source contract. Very large NFIP bulk datasets should be obtained from FEMA's official downloadable files using a separate streaming worker with permissions, checksums, privacy rules and resource limits.

## Run a read-only, bounded Posey data acquisition

Requires Python 3.12+, normal network access to FEMA; no API key. This command is **explicit**, not part of automatic PR tests:

~~~bash
python3 scripts/government/openfema_posey_snapshot.py \
  --out artifacts/openfema/posey-declarations-2026-11-16.json
~~~

The exporter requires the literal source filter for Posey **state=IN**, **fipsCountyCode=129**. It selects a limited set of declaration/history fields, refuses a partial result, confirms the returned state and county **per row**, and writes a non-overwriting JSON snapshot with an independent .sha256 sidecar. It includes the SHA-256 hash, size, requested URI and record count of each page, retrieval timestamp, limitations and provenance. The historical archive is left unchanged.

**Security:** A source-provided @odata.nextLink is not followed. Each next request is generated locally from a fixed HTTPS host, an allowlisted dataset and bounded $top/$skip. The client rejects redirects, malformed collection payloads, oversized pages and unsupported datasets. Network failures do not manufacture empty successful results. The supplied ordering can still change during concurrent FEMA updates; page hashes and retrieval times record this provenance limitation.

## Local reproducibility

~~~bash
python3 -m unittest backend.tests.test_openfema_client -v
python3 -m unittest discover -s tests/government -p test_openfema_posey_snapshot.py -v
node --test tsm-console/tests/openfema.test.mjs
node scripts/ci/validate-openfema.mjs
~~~

All tests run headlessly using synthetic records. To verify a completed snapshot:

~~~bash
sha256sum -c artifacts/openfema/posey-declarations-2026-11-16.json.sha256
~~~

**Required before promoting a live data layer:** official dataset version/fields, query scope, successful complete bounded harvest, checked raw hashes, metadata vintage and retrieved UTC, independent geographic join policy, appropriate disclosure/aggregation, no private owner joins, no implied FEMA effective map or permit. For floodplain geometry, use the [FEMA NFHL evidence chain](../fema/NFHL-BOUNDED-ACQUISITION.md); for geodetic accuracy, use [independent checkpoints](../geodesy/INDEPENDENT-CHECKPOINT-ACCURACY-2026-11-15.md).

**Federal citation:** Cite the FEMA dataset name, OpenFEMA API version and download URL, retrieved UTC, query filter, and documented limitations according to FEMA's [OpenFEMA Terms & Conditions](https://www.fema.gov/about/openfema/terms-conditions). Do not claim FEMA endorses TSM or that FEMA's public administrative data carries survey/engineering authority.
