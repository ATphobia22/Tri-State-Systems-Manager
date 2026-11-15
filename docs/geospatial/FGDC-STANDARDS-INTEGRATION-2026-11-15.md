# FGDC / ISO / OGC standards integration (2026-11-15)

The [FGDC download catalog](https://www.fgdc.gov/resources/download-geospatial-standards) is a **historical index, not a latest-edition resolver**. Do not silently substitute its older GeoTIFF 1.0 or ISO listings for the current editions of independent standards. The [FGDC metadata guidance](https://www.fgdc.gov/metadata/us-national-profile-iso19115/geospatial-metadata-standards) recommends ISO metadata transition but preserves CSDGM interoperability. Some ISO normative texts require paid licenses: store **references and implementation metadata**, not redistributed standards PDFs.

## Implemented

- `data/standards/fgdc-standards-profile-v1.json` records 10 standard-family references, explicit editions where confirmed, project uses and legacy-ingest status for CSDGM.
- `scripts/geospatial/fgdc_metadata_gate.py` validates the profile, existing Tri-State agency registry and **parses the checked-in FEMA CSDGM XML** as descriptive source metadata. It computes the current file SHA-256; this is local file integrity information, not proof that a dataset has been independently verified.
- Optional `--manifest path/to/metadata.json` checks declared source metadata records without network access. Schema is `tsm-geospatial-source-metadata` with nonempty `records`. Required per record: `datasetId`, `name`, `agency`, `sourceUri`, `sourceVersion`, `horizontalCrs` (EPSG), `verticalDatum`, `units`, `limitations`, `authorityClass`, and `verificationStatus`. Acquired records also need `retrievedAtUtc` UTC, `contentSha256`, and `localPath` pointing to an existing file beneath the repository root. The gate recomputes its checksum. `INDEPENDENTLY_REVIEWED` also requires reviewer, review timestamp and evidence URI.
- `tests/geospatial/test_fgdc_metadata_gate.py` covers actual XML parsing and evidence boundaries; `.github/workflows/fgdc-metadata-gate.yml` runs the checks headlessly.

## Commands

```bash
python scripts/geospatial/fgdc_metadata_gate.py
python -m unittest discover -s tests/geospatial -p test_fgdc_metadata_gate.py -v
python scripts/geospatial/fgdc_metadata_gate.py --manifest path/to/metadata.json
```

## Operational gates still required

1. For each **acquired raster/vector/model dataset**, record service/layer ID, spatial coverage, acquisition and publication dates (or explicit unknown), retrieved UTC, CRS, vertical datum, units, native resolution, license/access restrictions, local bytes, SHA-256, lineage and verification status. These vary by product and cannot be inferred from a catalog.
2. Validate the actual CRS and vertical reference using GDAL/PROJ metadata, EPSG operations, a suitable NOAA geoid model and independent survey/control before elevation conversion. `EPSG:2966` **alone** does not establish NAVD88. Never conflate ellipsoidal and orthometric heights, or assume ftUS versus meters.
3. Preserve FEMA CSDGM metadata; add independently tested ISO 19115-compatible metadata export against licensed ISO schemas. **Parsing XML is not an ISO 19139 export.**
4. Separately validate GeoTIFF/GeoPackage structure, IDs, timestamps, stage-gage datum conversions, raster/vector alignment, spatial/vertical uncertainty, model calibration, and FEMA authority.
5. Review licenses before mirroring ISO standards. This gate does **not** install GDAL, fetch new official data, certify geospatial products, or run Windows Shipping.

## Sources

- FGDC standards catalog: https://www.fgdc.gov/resources/download-geospatial-standards
- FGDC ISO metadata guidance: https://www.fgdc.gov/metadata/iso-standards
- FGDC CSDGM: https://www.fgdc.gov/metadata/csdgm-standard
- ISO 19157-1:2023 quality: https://www.iso.org/standard/78900.html
- OGC GeoTIFF 1.1: https://docs.ogc.org/is/19-008r4/19-008r4.html

**Gate category:** Offline headless descriptive-metadata compatibility, not federal standards conformance certification.
