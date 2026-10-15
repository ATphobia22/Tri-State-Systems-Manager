# Tri-State River Valley community AOI platform contract

**Status:** canonical regional product requirement  
**Updated:** 2026-10-15  
**Scope:** public/community-scale Ohio–Wabash confluence and Tri-State River Valley, not a single-property workflow.

## Product objective

TSM must let any authorized user in the Tri-State River Valley enter an address, select a map location or parcel, or provide site evidence and receive a repeatable, evidence-linked Area of Interest (AOI) screening. The architecture is regional and multi-user; the Posey County home AOI is one private test fixture and must not define the public product, default geography, or shared datasets.

## Regional coverage model

- Use a versioned, hydrologically meaningful regional extent spanning the Ohio–Wabash confluence and relevant Lower Wabash/Ohio River Valley communities across Indiana, Illinois, and Kentucky.
- Do not hard-code a private address, parcel ID, owner identity, private image, or one county as the only entry point.
- Resolve a user request to a selected point/address, parcel, structure, or user-drawn AOI. Permit a map-drawn AOI when no postal address exists.
- Select datasets by geometry, jurisdiction, source coverage, and product vintage—not by assuming all data providers have identical state coverage.
- Maintain a state/jurisdiction adapter registry for Indiana, Illinois, and Kentucky, plus federal/regional sources. Record unsupported coverage as a clear capability gap rather than returning false completeness.
- Support address, parcel, structure, farm/road/berm, drainage outlet, watershed, and community-scale AOIs as distinct typed geometries. Never equate parcel boundary with watershed catchment.

## User workflow

1. **Choose a place:** search address, click the map, select parcel/structure, draw a polygon, or import GeoJSON.
2. **Clarify intent:** property flood screening, drainage/catchment, infrastructure/road/berm, farm resilience, or community/regional study.
3. **Resolve location:** geocode and cross-check authoritative parcel/address/structure layers; show alternatives and confidence; ask for confirmation only when ambiguity materially changes the result.
4. **Collect data automatically:** acquire available terrain/imagery, hydrography/watersheds, federal flood layers, state floodplain products, precipitation/gages, and relevant infrastructure. Cache, version, hash, and retain provenance for every artifact.
5. **Run quality checks:** CRS, vertical datum, units, no-data, geometry validity, coverage, vintage, licensing, query scope, and topology. Preserve raw source responses and report errors explicitly.
6. **Produce the AOI package:** map, selected boundary and related geometry layers, source register, data-quality report, known limitations, evidence gaps, and next actionable steps.
7. **Advance hydrology only when ready:** identify outlet, delineate catchment, independently check basin, build model-input manifest, and gate HEC-HMS/HEC-RAS. A screening result is not a regulatory determination or engineering certification.
8. **Share safely:** private property and owner-uploaded imagery are private by default; only publish community-safe derived artifacts after explicit authorization and privacy review.

## Regional data and authority model

- Federal: USGS 3DEP elevation, USGS 3DHP hydrography and available watershed products, FEMA NFHL/FIRM/FIS and relevant LOMC products, NOAA precipitation-frequency products, USGS gages, and USACE regional/navigation/levee data where relevant.
- State/local: Indiana GIO/IGIO and INFIP/FARA/BAFM as applicable; corresponding authoritative Illinois and Kentucky GIS, parcel, elevation, and floodplain sources as available; county parcel/address/orthophoto sources where permitted.
- Regional model/study artifacts are reference context, not automatically valid parcel-scale model inputs. Preserve vertical datums and conversion lineage.
- Keep regulatory planes separate: FEMA insurance/effective-map products, state/local planning products, observed events, and modeled scenarios must not be blended into one unlabeled “flood zone.”

## Data architecture and provenance

Every source adapter emits a common envelope: source ID, jurisdiction, URL/service endpoint, request geometry and parameters, retrieval time, source vintage/effective date, HTTP/service outcome, license/terms, CRS, horizontal/vertical datum, units, feature count, coverage, raw artifact URI, SHA-256, parser/version, validation results, and limitations. Cache keys must include normalized request geometry, source version, parameters, and relevant auth scope. Transient failure must never be represented as an empty valid dataset.

Use multi-tenant boundaries for user uploads, saved sites, parcel-linked notes, and exports. Avoid exposing personal property data in shared indexes, telemetry, logs, public reports, fixtures, or demos. Support retention/deletion policies for user-supplied content.

## Machine-readable states

Use explicit states, at minimum:
- `NOT_REQUESTED`
- `QUEUED`
- `FETCHED_UNVALIDATED`
- `VALIDATED`
- `PARTIAL_COVERAGE`
- `BLOCKED_MISSING_INPUT`
- `BLOCKED_SOURCE_FAILURE`
- `BLOCKED_DATUM_OR_CRS`
- `REQUIRES_HUMAN_REVIEW`
- `APPROVED_FOR_SCREENING`
- `BLOCKED_NOT_RUN`
- `COMPLETE_WITH_LIMITATIONS`

Do not use one global “complete” status when source coverage is partial. Each source, geometry, analysis, and approval gate has its own state.

## Required quality and safety gates

- No-data sentinels (including `-9999`) normalize to null while preserving raw value and source semantics; zero is never accepted as BFE without valid source semantics, datum, and metadata.
- Unknown vertical datum, invalid CRS transform, failed data acquisition, stale map vintage, or missing terrain coverage blocks affected calculations.
- A candidate outlet is not a verified outlet; hydrography proximity is not proof of hydraulic connectivity.
- A parcel is not a catchment. No design flow, depth, WSE, no-rise, or engineering recommendation without documented inputs, validated methods, and the appropriate professional review.
- Human confirmation and professional/regulatory approval are separate from automated technical readiness.

## Acceptance criteria

- [ ] A user can initiate AOI screening without using the private Posey County test address.
- [ ] Regional extent/configuration is versioned and covers the declared Tri-State service region.
- [ ] Address, map point, drawn polygon, parcel, structure, and imported geometry paths are supported or reported as explicit planned capability gaps.
- [ ] Jurisdiction-aware source registry routes requests to IN/IL/KY and federal/regional adapters.
- [ ] Every source returns provenance and an explicit success/partial/failure state.
- [ ] Geometry and terrain checks block invalid downstream work.
- [ ] AOI artifacts and exports are reproducible, evidence-linked, and privacy-scoped.
- [ ] Catchment delineation and modeling remain gated by outlet evidence and independent QC.
- [ ] Automated tests include all three states, boundary-crossing AOIs, missing-source scenarios, datum conflicts, no-data sentinels, duplicate features, cache invalidation, and tenant privacy.
- [ ] CI is checked on the exact main commit; no status records means unverified, not green.

## Site-specific case handling

The existing `13101 Bonebank Road` record remains a private, owner-confirmed test case under `data/posey-county/`. Keep it out of public defaults and regional demo data. The user’s aerial image and the associated owner confirmation must remain access-controlled and must not be copied into generic fixtures or public examples.

## Implementation sequence

1. Create regional AOI configuration and jurisdiction-aware source registry.
2. Implement common source/provenance envelope and artifact cache.
3. Implement AOI intake APIs/UI for address, map click, drawn polygon, parcel/structure selection, and GeoJSON import.
4. Implement geometry reconciliation, data coverage visualization, and evidence report.
5. Add DEM/hydrography acquisition and QA jobs.
6. Add FEMA/state-specific flood-data overlays and authority separation.
7. Add outlet evidence and catchment delineation with independent QC.
8. Add model-readiness manifests and explicit HMS/RAS blocked states.
9. Add privacy isolation, integration tests, accessibility, and main-branch CI gates.
10. Validate against several public/regional test locations across IN/IL/KY, not only the private owner case.
