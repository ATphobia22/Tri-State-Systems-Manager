# Source inventory reconciliation and computation handoff

This is a **headless, offline, read-only preflight**, not agency authentication, engineering certification, live data acquisition, survey verification or effective FEMA determination. A passing synthetic unit test does not validate a county dataset.

## Architectural route

1. **Discover:** record issuing authority, exact service/layer ID, release/version, source URL, product acquisition/publication dates, retrieval timestamp, coverage FIPS, horizontal CRS, vertical datum, units and limitations.
2. **Acquire:** retain original source bytes and immutable SHA-256/size receipts outside ordinary Git when large. Keep source release identity and transform provenance.
3. **Reconcile:** compare observed and expected feature counts, stable unique feature IDs, release identity, coverage FIPS and physically hashed source bytes. Never silently reduce an expected inventory (e.g. 23,082 Posey buildings).
4. **Validate frame:** verify horizontal CRS independently of vertical datum. Datum UNKNOWN/NONE/NOT_APPLICABLE is not a license to calculate a NAVD88 water-surface elevation or surveyed structure height.
5. **Review:** require separate human/agency evidence for calculations, effective FEMA NFHL including incorporated LOMCs, per-structure BFE, hydrologic/stage calibration, scientific uncertainty, engineering signoff and regulatory filings. A hashed review receipt is not proof the reviewer or agency authenticated it.
6. **Route:** make missing evidence visible in the map UI; do not invent readings or automatically substitute planning layers for effective FEMA authority. Engineering consumption is **never automatically authorized** by this module. The existing `backend/regulatory_authority_boundary.py` independently checks Merkle-bound source/technical packets but does not grant agency approval.
7. **Release:** only after latest-main CI, independently verified actual UE5.8 native Shipping package, clean offline Windows 11 launch and headed render evidence can the Windows-native release gate be closed.

## Contract and command

```bash
python -m unittest backend.tests.test_dataset_inventory_gate -v
python backend/evidence/dataset_inventory_gate.py --manifest /path/to/candidate.json --root /path/to/evidence --require-reconciled
```

Manifest schema: `tsm-dataset-inventory-reconciliation-v1`. Supply `intendedUse` (VISUALIZATION, ENGINEERING, REGULATORY_SCREENING), `source` (datasetId, authority, serviceLayerId, releaseId, sourceUri, limitations, units, horizontalCrs, verticalDatum, acquiredAtUtc, publicationAtUtc, retrievedAtUtc, snapshot), and `inventory` (expectedCount, observedCount, expectedCountyFips, featureIdInventory). Each snapshot/index references a relative, non-symlink, physical path with SHA-256 and byte size.

Feature index JSON: `{"schema":"tsm-feature-id-inventory-v1","datasetId":"...","releaseId":"...","countyFips":["18129"],"featureIds":["..."]}`. A source-specific independent review record may be supplied as `review.evidence` with a hashed path.

A result of `RECONCILED_FOR_PREVIEW` means only that the *provided* source and ID index passed local consistency tests. `engineeringReviewReady` signals review preparation, **not authorization**. `engineeringConsumptionAuthorized` remains false, and `regulatoryDetermination` remains null.

Unresolved external inventory and provenance work is not marked complete: actual Posey building count/height identity joins; definitive FEMA panel + effective LOMC/BFE scope; DNR hydrogeologic source interpretation; 3DEP vertical accuracy; HEC-RAS calibration; physical UE5.8 Shipping/air-gapped runtime proof.
