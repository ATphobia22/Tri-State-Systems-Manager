# GeoTruth public-map / native Passport / Foundry-ledger integration

**Implemented on feature branch, 2026-11-18.** This is new integration wiring, **not** a claim that full Unreal Shipping and headed browser acceptance have been reproduced. Existing TSM scientific authority and immutable ledger controls remain unchanged.

## A. GeoTruth in collapsible public GIS menus

Reusable React component: `tsm-console/src/components/GeoTruthLayerControl.tsx`, backed by privacy-safe, bounded normalization in `tsm-console/src/lib/geotruth-map-layer.ts`.

- Integrated in both `RealWorldTwinMap.tsx` (nested in existing **Map overlays and camera controls** collapsible group) and `TriStateDigitalTwinMap.tsx` (existing collapsible 3D layer sidebar).
- **No automatic download**: operator chooses **Load QA layer (opt-in)**.
- Loads only same-origin published `3d-tiles/buildings-3d.json`, capped at 36 MiB and 30,000 GeoJSON features; no remote GIS credential or service.
- Renders **existing** Polygon/MultiPolygon geometries as MapLibre fill/outline layers. No geometry synthesis, source ID replacement, or conversion from NAVD88 to ellipsoid.
- Removes all owner and other unnecessary source properties, retaining only source ID, QA status, estimated height (nullable) and explicit unverified datum/lineage labels.
- Distinguishes imported height estimates, missing/invalid heights and duplicate/missing/conflicting source IDs. Map clicks show only OBJECTID/status. MapLibre style lifecycle is isolated to named `tsm-geotruth-qa-*` layers.
- Browser rendering layer is QA context only. It does **not** prove 23,082 building completeness, independent height accuracy, full GLB coverage, 3D Tiles content validation or regulatory use.

Reference API: https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/ (addSource, addLayer, style visibility and source/layer cleanup).

## B. Native Unreal HUD Passport action

`tsm-native/Source/TSMNative/TSMEngineeringHUD.cpp` now offers **EXPORT PASSPORT JSON**, a real local file-copy action wired to the native HUD's button handler.

**Input (read-only):** `<Unreal ProjectSavedDir>/PublicEvidence/parcel-evidence.json`. First create it using the existing audited snapshot and `scripts/public_interest/evidence_kit.py passport`. The native action does not fetch external data and will report SOURCE_UNAVAILABLE when no file is present.

**Output (new only):** `<ProjectSavedDir>/CivicExports/parcel-evidence-YYYYMMDD-HHMMSS.json` and `...receipt.json`, with SHA-256 of the actual reserialized and disk-readback-verified exported bytes, plus a separate raw input SHA-256, using the existing `TSMCrypto` SHA-256 implementation. It rejects files over 2 MiB, wrong schema, incorrectly asserted engineering/regulatory/survey use, malformed declared digests, unsupported root/fact keys, and facts that assert independent value validation. The exporter reserializes allowlisted public fields to remove unparsed duplicate-key content, verifies the written JSON by SHA-256 readback, and never overwrites an existing export or receipt.

**Limitations:** The receipt labels `passportIntegrityValidation=DECLARED_NOT_REVALIDATED`. The native path does **not** independently recompute Python's canonical JSON digest or issue a professional validation. The exported JSON is normalized for privacy rather than guaranteed byte-identical to the input. It exports JSON, **not Word or Excel inside the HUD**. For DOCX/XLSX offline documents, run the already implemented headless `scripts/public_interest/evidence_packet_export.py` on a separately verified passport JSON. No Python, browser/localhost, external executable, mandatory login or WebView is launched from the HUD.

The native UI/source has source-level tests. Only an **actual UE5.8 Windows Shipping build and headed offline operator click** can prove runtime compilation and execution. Release gate remains NOT_EVIDENCED until that test.

## C. Contract Foundry report connected to the Evidence Ledger review surface

Headless adapter: `scripts/government/foundry_ledger_queue.py`; safe client parser: `tsm-console/src/lib/foundry-ledger-review.ts`; user-facing component: `FoundryLedgerReview.tsx`, added to `routes/LedgerView.tsx` **beside** the existing immutable log and Human Sign Gate.

1. Produce an actual local Foundry contract report (and optionally a comparison to a dated previous catalog):
   ```sh
   python scripts/government/contract_foundry.py \
      --catalog data/schemas/tsm-indiana-data-catalog-v1.json \
      --plane-map data/acquisitions/tsm-data-plane-integration-v1.json \
      --output dist/innovation/current-source-contracts.json
   ```
2. Generate the deterministic, SHA-linked review queue:
   ```sh
   python scripts/government/foundry_ledger_queue.py \
      --foundry dist/innovation/current-source-contracts.json \
      --output dist/innovation/foundry-ledger-review.json
   ```
3. Open **Evidence Ledger → Government Data Contract Foundry · Human-review queue**, expand the panel and import the local JSON file. Filter rows by source ID, review field, and declared affected data plane.

The queue schema `tsm.government.foundry-ledger-queue.v1` includes `sourceReportSha256`, `catalogSha256`, immutable per-entry payload SHA-256, `PENDING_HUMAN_REVIEW` state, exact source IDs and `DECLARED_ONLY` plane impact. The browser rejects files implying approval or an authoritative ledger append. The parser's schema/digest-format check **does not** rehash the original Foundry input.

**Important:** this is an **in-ledger-screen review queue**, not an automated write to the server-owned immutable Merkle log. `ledgerMutationPerformed=false`; `ledgerSubmissionState=NOT_SUBMITTED`; human authorization remains final. A separate audited server intake plus authorized human sign transition is needed for authoritative immutable insertion.

## Headless checks

```sh
node --experimental-strip-types --test \
  tsm-console/tests/geotruth-qa-map.test.mjs \
  tsm-console/tests/foundry-ledger-review.test.mjs
python -m unittest discover -s tests/government -p test_foundry_ledger_queue.py -v
python -m unittest discover -s tests/innovation -p test_native_passport_export_wiring.py -v
```

Workflow: `.github/workflows/tsm-geotruth-ledger-native.yml` also runs existing innovation and public-evidence tests and emits the optional local review queue as a downloadable GitHub Actions advisory artifact. No user or agency email is sent and no calendar event is made.

## Remaining required acceptance

- Headed browser click-through on **both** map views, verify GIS QA toggle, source loading/cleanup, on-map status and native 3D tiles not obstructed; capture screenshots and console.
- Real Windows 11 x64 UE5.8 Shipping BuildCookRun, offline launch, button click, output JSON and receipt SHA independently checked. This source diff is not that evidence.
- Optional installer staging of a trust-reviewed standalone DOCX/XLSX helper (not included in native release), without network or WebView dependencies.
- Authenticated/authorized server-side advisory review intake and immutable evidence hash chain only after explicit human action; never silent regulatory approval.
- Confirm new official building heights, datum, and 267 archived OBJECTID reconciliation independently; UI QA labels remain unverified until that work is evidenced.
- Continue to respect general CI security audit, source freshness, and exact branch/commit required checks before merging.
