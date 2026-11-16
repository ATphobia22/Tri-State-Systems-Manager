# Federal Register document evidence — headless, read-only adapter

**Status:** Standalone adapter proposed for integration; a live API receipt, native Windows linkage, and current rule applicability are **not evidenced** by the initial implementation.

## Reviewed National Archives repositories

- [federalregister-api-core](https://github.com/usnationalarchives/federalregister-api-core) — published-document search, agency/citation metadata, and import/API architecture.
- [federalregister-web](https://github.com/usnationalarchives/federalregister-web) — reference for document timelines, search facets and provenance display.
- [Official FederalRegister.gov API documentation](https://www.federalregister.gov/developers/documentation/api/v1).

**Reuse boundary:** This is a new Python standard-library implementation using the documented public HTTP API, not a copy or fork of the Ruby/Rails sources. The upstream api-core project is AGPLv3; any reuse of its source code requires a separate dependency/license review. Do not copy official National Archives/Office of the Federal Register logos or seals.

## TSM placement and authority separation

Networked *headless* ingestion (explicit opt-in) -> local raw API responses + SHA-256 -> normalized regulatory candidate index -> source review -> optional local visual timeline in the existing experience.

The API source is **regulatory publication metadata**, not a grant NOFO, proof of an open grant application window, proof of parcel applicability, an official regulatory determination, or a replacement for FEMA's effective FIRM/FIS/LOMC records. Proposed and effective rules must remain distinct.

Potential topics: FEMA proposed flood hazard determinations, USACE rulemaking, EPA water rules, and published federal funding-policy changes. Connect document number/citation to the controlling agency's effective materials separately.

## Use: fully offline fixture replay

A saved JSON response from the official published-documents API can be replayed without internet:

~~~bash
python3 scripts/regulatory/federal_register_ingest.py \
  --fixture /path/to/saved-api-response.json \
  --term "flood hazard determinations" \
  --output /path/to/tsm-federal-register-evidence.json
~~~

## Use: bounded live search (requires deliberate opt-in)

Run only on a machine that is allowed to access the documented federal API:

~~~bash
python3 scripts/regulatory/federal_register_ingest.py \
  --live --term "flood hazard determinations" \
  --since 2026-01-01 --until 2026-11-16 \
  --per-page 20 --max-pages 2 \
  --output /path/to/tsm-federal-register-evidence.json
~~~

The adapter never runs on import or on native application startup. It does not serve HTTP, requires no API key, does not send grant applications, and makes no web calls when using a local fixture. It rejects redirects, non-JSON responses and unexpected source-link hosts. Each response is capped at 4 MiB, and a query is limited to at most 5 pages of 100 records.

The output contains raw response sidecars plus SHA-256 digests, retrieval timestamp, Federal Register document number, original links, title, agencies, publication date, citation, docket/RIN where available, and explicit NOT_ASSESSED labels for legal applicability and grant status. CRS, vertical datum, units and spatial coverage are intentionally not inferred from regulatory publication text. Source records require human review.

Run the headless offline tests:

~~~bash
python3 -m unittest discover -s scripts/regulatory -p "test_federal_register_ingest.py" -v
~~~

## Operational constraints

1. FederalRegister.gov's web representation is informational. For legally operative claims verify against the official Federal Register edition and applicable agency/CFR records; [govinfo.gov](https://www.govinfo.gov/) hosts official editions.
2. FederalRegister.gov can restrict some automated web requests. Use the published API and do not bypass access controls or scrape the website.
3. A keyword/date search is not proof that no notice exists. Corrections, later effective dates, and agency-specific requirements must be reviewed.
4. Keep original response JSON with the snapshot, verify SHA-256 before using it, and separate retrieval time from publication/effective time. Do not claim regulatory certification or geographic applicability automatically.
5. If a UI timeline is added, it should consume the locally staged manifest and clearly distinguish document publication, comment close, and effective date; link back to the official source.

## Remaining gates (not claimed complete)

- Successfully run and inspect live API receipts and verify real document metadata at a known publication date.
- Independently validate crosswalks to FEMA NFHL/effective FIRM, state DNR/IL/KY authority rules, and grant program notices.
- Wire snapshots into the local desktop/native UI and validate offline visualization.
- Separately verify Unreal Shipping, 3D-building inventory, stage datum, and Windows offline startup.
