# Missing-Source Recovery

**Date:** 2026-10-01  
**Status:** Reproducible recovery path implemented; external offline-bundle mismatches remain explicitly blocked.

## Root-cause findings

The latest repository receipt reports **451 of 457** offline-bundle entries SHA-256 verified. The remaining six records are three county parcel entries, one Union County FEMA artifact, and two existing flood artifacts with recorded byte-count mismatches.

The raw 11.2 GB bundle remains outside standard Git. The two mismatch cases are therefore not replaced with guessed or third-party bytes.

## Recovered authoritative sources

- **Indiana White County parcels:** Indiana GIO 2025 statewide parcel FeatureServer with exact \`county_fips='17193'\` filtering.
- **Henderson County, Kentucky parcels:** official Henderson KY GIS public Parcels FeatureServer, clipped to the exact TIGER county polygon.
- **Union County, Kentucky parcels:** official Union County Parcels FeatureServer, clipped to the exact TIGER county polygon.
- **Union County FEMA NFHL:** direct FEMA public NFHL Flood Hazard Zones layer 28, queried with \`DFIRM_ID LIKE '21225%'\` and the exact county polygon.

## Authority / privacy rules

- FEMA effective NFHL remains distinct from preliminary/pending products and state BAFM.
- Parcel recovery requests only public parcel identifiers and non-owner spatial attributes; owner/mailing fields are not requested.
- Exact TIGER county geometry is used; bounding-box-only extraction is not accepted.
- Every recovered artifact receives SHA-256, byte count, source URL, retrieval timestamp, feature count, and spatial relation metadata.
- The two offline-bundle mismatch records remain \`requires-offline-bundle-reconciliation\` until the raw bundle is available to the runner.

## Verification chain

\`source → exact-county query → schema/privacy filter → geometry validation → SHA-256 → artifact upload → integrity verification\`
