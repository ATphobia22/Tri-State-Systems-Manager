# TSM Civic Innovation Triad — GeoTruth + Evidence Passport + Data Contract Foundry

**Build scope:** Three headless, offline, standard-library Python capabilities integrated with **existing** TSM geospatial/building metadata, public evidence passport, and government source-drift contracts. Rendering (if desired) is an independent MapLibre/Unreal UI step. This change does **not** install Microsoft Office, require a Microsoft identity, download data from an agency, or certify a 3D Tiles/UE5.8 runtime.

**Inputs are existing repository files, not fresh surveys.** The existing archived project Posey identity comparison states 23,082 source footprints and 22,815 published GeoJSON screening features, with 267 archived OBJECTIDs missing. The archived project source vintage and current measured geometry/heights have not been independently validated. The visible GeoJSON screening layer is not proof that every building has a renderable GLB. Do not substitute 2D GeoJSON for 3D Tiles content.

## 1. GeoTruth Inspector — source identity & 3D building QA

Implementation: `scripts/geospatial/geotruth_inspector.py` reuses `scripts/geospatial/reconcile_published_buildings.py` instead of guessing identifiers. It checks the **actual published GeoJSON SHA-256** against the separately recorded archived 2026-10-25 pin. Exact missing OBJECTIDs are displayed **only when those published bytes match the archived pin**. A changed publication causes `SOURCE_ID_SET_UNVERIFIED` until the two real identities are reconciled again. The tool does not claim official survey accuracy or distinguish missing roofs from pipeline policy choices.

```sh
python scripts/geospatial/geotruth_inspector.py \
  --published tsm-console/public/3d-tiles/buildings-3d.json \
  --pinned-delta data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json \
  --output dist/innovation/geotruth-posey-qa.json \
  --qa-geojson dist/innovation/geotruth-posey-overlay.geojson
```

The optional QA layer only **copies actual published geometries** and emits sourceObjectId, imported height estimate, QA status, and explicit `verticalDatumVerified=false`; it never generates missing geometry. Load its local GeoJSON into the public MapLibre viewer as a separate toggleable QA overlay *after* independent visual/functional tests. Do not treat the layer as a renderable 3D Tiles product or a verified NAVD88 height surface. Actual roof-fit residuals require independent point cloud/control measurements: none are invented here.

Output statuses: `HEIGHT_NOT_EVIDENCED`, `HEIGHT_INVALID`, `HEIGHT_ESTIMATE_UNVERIFIED`, `SOURCE_ID_UNAVAILABLE`, and `CONFLICTING_SOURCE_IDS`. The separate archived-ID claims, source/asset SHA, unverified heights, full mesh rendering, and regulatory use are all explicit fields.

## 2. Civic Evidence Passport — offline portable review packet

The existing `scripts/public_interest/evidence_kit.py` **already** audits local source bytes and builds informational parcel evidence passports with source IDs/hashes, uncertainty states, datum and observation timestamps. We reuse it rather than building a rival passport schema.

```sh
python scripts/public_interest/evidence_kit.py audit /path/to/verified-snapshot/

python scripts/public_interest/evidence_kit.py passport \
  /path/to/verified-snapshot/ /path/to/parcel-public-facts.json \
  --as-of 2026-11-17T12:00:00Z \
  --out dist/innovation/parcel-evidence.json \
  --html dist/innovation/parcel-evidence.html

python scripts/public_interest/evidence_packet_export.py \
  --passport dist/innovation/parcel-evidence.json \
  --out-prefix dist/innovation/parcel-evidence
```

`evidence_packet_export.py` validates the existing passport's canonical integrity digest, only accepts explicit `engineeringUse=false`, `surveyCertification=false` and `regulatoryDetermination=false`, and produces:

- `parcel-evidence.docx`: an actual minimal WordprocessingML Open XML package with evidence statuses and source SHA fields.
- `parcel-evidence.xlsx`: an actual minimal SpreadsheetML Open XML package; **all cells are inline strings**, never executable formulas, external hyperlinks, or macros. User strings beginning with `=`, `+`, or `@` are inert text.
- `parcel-evidence.receipt.json`: SHA-256 of the raw input passport, original passport integrity digest, and hashes of both exported files.

No private owner field is copied; only an explicit public-field allowlist is used. Output files are created exclusively and existing files cannot be overwritten. This is a minimal Python standard-library implementation of the Open XML ZIP formats, **not the .NET Open XML SDK**. A future isolated .NET exporter can validate/extend formatting without becoming a native Windows runtime dependency. Refer to Microsoft Office Open XML specs and SDK documentation before distributing polished branded templates.

## 3. Government Data Contract Foundry — source registration + plane dependency review

Implementation: `scripts/government/contract_foundry.py` reuses `scripts/government/source_contract_impact.py` and the repository's already-defined 15 data planes in `data/acquisitions/tsm-data-plane-integration-v1.json`.

```sh
python scripts/government/contract_foundry.py \
  --catalog data/schemas/tsm-indiana-data-catalog-v1.json \
  --plane-map data/acquisitions/tsm-data-plane-integration-v1.json \
  --output dist/innovation/government-contracts.json

# With two actually different dated source catalog snapshots:
python scripts/government/contract_foundry.py \
  --before /path/to/previous-catalog.json \
  --catalog /path/to/current-catalog.json \
  --plane-map data/acquisitions/tsm-data-plane-integration-v1.json \
  --output dist/innovation/government-contract-drift.json
```

This compiles normalized source IDs, agency, endpoint, service/layer ID, CRS, vertical datum, units, geographic coverage, source/version/dates and any catalog-provided checksum. Missing fields become `NOT_EVIDENCED` review items; **neither input's registry `VERIFIED` label nor an HTTPS URL constitutes independent data acquisition or validation**.

The optional drift section reuses the existing field comparison. The plane impact map uses **exact source ID matching**, reports unmapped and unresolved IDs explicitly, and labels affected plane relationships `DECLARED_ONLY`; an absent/renamed source is not silently matched to a nearby-looking one. It flags potential joins to review, not actual geometry corruption or verified runtime faults.

## 4. Test and CI contract

```sh
python -m unittest discover -s tests/innovation -p test_triad_products.py -v
python -m unittest discover -s scripts/public_interest -p test_evidence_kit.py -v
python -m unittest discover -s tests/government -p test_source_contract_impact.py -v
```

`.github/workflows/tsm-civic-innovation-triad.yml` runs these suites on Python 3.12, produces the foundry contracts from TSM's 26-source existing catalog, and checks the current Posey published screening GeoJSON against the archived pin. The outputs are GitHub Actions advisory artifacts; **no release status is inferred from passing Python source tests**.

## 5. Existing TSM integration points

| Product | Existing TSM contract reused | Output and next integration |
| --- | --- | --- |
| GeoTruth | `reconcile_published_buildings.py`, pinned archived delta, published `buildings-3d.json` | JSON status + optional MapLibre GeoJSON overlay; **UI wiring and headed render tests still needed** |
| Evidence Passport | `evidence_kit.py` snapshot audit and existing `tsm.public-evidence.passport.v1` | DOCX/XLSX/receipt generated offline; operator UI export action is a separate future task |
| Contract Foundry | `source_contract_impact.py` exact-ID change map, existing TSM 15-plane integration manifest, Indiana/Federal catalog | Per-source review contract + optional data-plane impacts; **live agency snapshot and UI ingestion still needed** |

Data and scientific authority flow:

```text
 Official acquisition (existing, external, date/bytes validated separately)
     │
     ├─> immutable local source snapshots ──> evidence_kit passport
     │                                            └─> Passport DOCX / XLSX + receipt
     ├─> source catalog snapshots ──> Contract Foundry ──> 15-plane declared impact
     │
     └─> archived building inventory + published GeoJSON ──> GeoTruth
                                                      └─> QA JSON / GeoJSON overlay

 UE5.8/MapLibre scene: read-only presentation, requires separately tested wiring
```

### Scientific and release boundaries

- FGDC recognizes ISO 19115 metadata and ISO 19157 data quality standards. These tools expose missing quality metadata but do not implement full ISO 19115/19157 conformance validation. Reference: https://www.fgdc.gov/standards/news/fgdc-iso-metadata-standards
- USGS describes applying ASPRS positional accuracy measures using independent ground checkpoints. Imported building heights without checkpoints are **not vertical accuracy tests**. Reference: https://www.usgs.gov/ngp-standards-and-specifications/adopt-updated-accuracy-standards
- OGC 3D Tiles 1.1 defines renderable tiled scene formats; a GeoJSON QA overlay does not validate full GLB geometry, texture, ellipsoidal placement or UE5 rendering. Reference: https://docs.ogc.org/cs/22-025r4/22-025r4.html
- Python's ZIP/XML implementation here produces interoperable Open XML parts; reference: https://learn.microsoft.com/en-us/office/open-xml and https://github.com/dotnet/Open-XML-SDK
- No generated document, status field, screenshot, source-domain name, checksum or map layer constitutes FEMA determination, survey certification, legal approval, emergency direction, or professional-engineering signoff.
- All nonvisual ingestion/QA/reporting is headless and **works offline** without WebView or localhost. Windows UE5.8 Shipping packaging and headed visual acceptance require separate runner evidence. Human Authority Final.

## Next engineering tasks

1. Independently recover or explain all missing archived building IDs, resolve published source version changes and verify actual heights/control data; use GeoTruth output for manual prioritization, never as a fabricated height filler.
2. Add a collapsible QA overlay toggle to the public Atlas with local-file fallback, explicit legend, and headed screenshot test. Keep source uncertainty visible.
3. Add an in-native operator export action that invokes the bounded offline passport CLI and opens the generated files without embedding a browser.
4. Bring in dated official source snapshots with source/version checksums, then connect Foundry review items to the evidence ledger and UI. Unresolved data-plane source aliases must be reviewed explicitly rather than guessed.
5. Independently validate staged TSMData, native terrain/3D building tiles, and Windows 11 UE5.8 Shipping offline startup with an authorized Windows runner.
