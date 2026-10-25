# Earth-observation research integration — 2026-10-25

## Implementation status

This change registers source metadata and deterministic policy checks for two candidate satellite sources. It does **not** implement a live provider API adapter, download imagery, train a classifier, or claim TSM has verified source access.

Machine-readable source contract: `data/fabrics/earth-observation-research-integration-v1.json`.

## OlmoEarth v1.3

Ai2 released OlmoEarth v1.3 with annual global satellite embeddings and a browser-based Embeddings Explorer. The model combines Sentinel-1 radar, Sentinel-2 multispectral, and Landsat time series into 64- or 128-dimensional embeddings at a nominal 10 m pixel grid. Ai2 reports global 2023–2025 coverage at launch and selected-country coverage for 2017–2022; every AOI/year/tile still needs coverage verification and source provenance.

- Release: https://allenai.org/blog/olmoearth-v1-3
- Explorer: https://olmoearth.allenai.org/
- Code: https://github.com/allenai/olmoearth_projects
- License: https://data.source.coop/olmoearth/olmoearth-v1-3-embeddings/LICENSE.txt

**TSM use boundary:** derived-feature screening for land-cover/surface-change analysis and research classifiers only. Require exact tile/year, model version, source-scene lineage where supplied, CRS/transform/nodata/checksum, labeled ground truth, spatially separated holdout evaluation, calibration/uncertainty, and analyst review.

**License gate:** the OlmoEarth Artifact License restricts certain military/defense uses and certain extractive activities, including activities that facilitate mineral/oil/gas extraction and deforestation. Legal/compliance review must establish whether the intended TSM workflow is permitted before deployment or distribution of derived artifacts. This integration intentionally does not download or redistribute licensed data.

## Planet Tanager hyperspectral data

Planet announced a NASA Commercial Satellite Data Acquisition evaluation task order covering more than 250,000 km² of archived and newly tasked data. The announcement describes Level 1C top-of-atmosphere reflectance and Level 2A surface-reflectance products, more than 400 contiguous spectral channels, and 30 m nominal resolution. The evaluation is intended to assess data quality and scientific utility; it is not a guarantee of public availability or TSM entitlement.

- Planet announcement: https://www.businesswire.com/news/home/20261021824897/en/Planet-Awarded-NASA-Commercial-Satellite-Data-Acquisition-CSDA-Evaluation-Task-Order-for-Tanager-Hyperspectral-Data
- NASA's Planet CSDA vendor page: https://science.nasa.gov/earth-science/csda/vendor-planet/

**TSM use boundary:** research-only until provider eligibility, API access, product availability, calibration, atmospheric correction, quality masks, spectral metadata, and intended-use rights are verified. Preserve product level and spectral band metadata. Do not infer flood depth, water-surface elevation, channel bathymetry, or hydraulic boundaries from reflectance alone.

## Validation and release gate

Run:

```bash
node scripts/ci/validate-earth-observation-research-integration.mjs
cd tsm-console
./node_modules/.bin/vitest run tests/earth-observation-research-integration.test.ts tests/data-fabric-registry.test.ts
```

The validator verifies metadata completeness, status honesty, provenance requirements, source authority boundaries, and license/access gates. A passing contract is not proof of live data access, model accuracy, complete geographic coverage, or production integration. The geospatial GitHub Actions workflow now invokes this validator and the targeted Vitest contract.

## Research quality principles

- Use spatially separated holdout validation rather than relying only on random pixel splits.
- Report the prediction domain, season/year, label source, spatial resolution, uncertainty, and known distribution shifts.
- Compare change-detection outputs with independent imagery or field/reference data before treating a candidate as a change event.
- Keep observations, model-derived features, downstream classifications, forecasts, and regulatory determinations as separate authority classes.
- Never replace missing data with fabricated values or mark an AOI/model run approved solely because a map can be rendered.
