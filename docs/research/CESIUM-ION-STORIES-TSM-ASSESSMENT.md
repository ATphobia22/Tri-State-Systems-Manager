# Cesium ion Stories: Research and TSM Integration Decision

**Research date:** 2026-10-23  
**Scope:** Public Cesium documentation and the current TSM repository  
**Decision status:** Architecture recommendation; no Cesium ion account, token, paid service, or hosted asset is assumed.

## Executive decision

Treat **Cesium Stories as an optional, account-backed presentation/export path**, not as TSM's core runtime or a required dependency.

TSM already has a documented self-hosted CesiumJS path and an OGC 3D Tiles pipeline intended to work without a Cesium ion token. Preserve that capability as the default for reproducible, low-secret, offline-capable operation. Use Cesium Stories only when an authorized operator deliberately creates a public or appropriately approved stakeholder presentation in Cesium ion.

The recommended boundary is:

- **TSM is authoritative** for source identity, dataset version, acquisition time, coordinate reference system, vertical datum, model run identity, validation status, provenance, and evidence hashes.
- **CesiumJS + TSM-hosted OGC 3D Tiles** is the default interactive 3D viewer.
- **Cesium Stories** is a supplementary narrative presentation, authored and shared by an account holder; it is not a replacement for TSM's data services, evidence ledger, access control, or scientific computation.
- No runtime, build, test, or public deployment should fail because a Cesium ion account, token, asset ID, or Story URL is absent.

## What Cesium Stories provides

Official Cesium documentation describes Stories as a no-code authoring and presentation tool that can combine Cesium's global basemap/terrain context with user assets and narrative slides.

Documented capabilities include:

- Multi-slide scenes and saved camera views.
- Narrative titles, infobox text, and images.
- Feature styling based on metadata.
- Lightweight measurements for distance, height, slope, and area.
- Time-dynamic visualization, including animated KML and CZML workflows.
- 2D data overlays such as KML, GeoJSON, and CZML, plus supported 3D content prepared for streaming.
- Shareable presentation URLs and an embed option.

Primary documentation:
- [Cesium Stories overview](https://cesium.com/learn/ion/cesium-stories-overview/)
- [Create an interactive 3D presentation](https://cesium.com/learn/ion/stories-introduction/)
- [Visualizing time-dynamic data](https://cesium.com/learn/ion/stories-time-dynamic/)
- [Cesium ion overview](https://cesium.com/learn/ion/)

The detailed tutorial requires signing in to a Cesium ion account to create and upload a Story. Therefore, this repository can document the integration contract without creating or publishing a Story in the absence of an authorized account.

## Relevance to TSM flood and infrastructure workflows

The strongest use is communication and orientation—not hydrologic computation.

Potential Story chapters for an approved public-facing flood-risk briefing:

1. **Area and terrain context** — orient the audience and describe the AOI and terrain source.
2. **Authoritative flood-hazard context** — show the effective FEMA layer/panel and source date, with a clear caveat that the visualization itself is not a site-specific regulatory determination.
3. **Observed conditions** — show time-stamped gage/water-level observations with station, units, source, observation time, and freshness.
4. **Scenario comparison** — show clearly labeled model-derived or illustrative scenario outputs, with model/run ID and validation status.
5. **Exposure context** — present buildings, roads, facilities, and evacuation/shelter context only where data licenses and publication approval permit.
6. **Limitations and provenance** — state datum/CRS, model assumptions, missing inputs, uncertainty, and review/approval status.

Cesium's published Tokyo Metropolitan Digital Twin case study demonstrates the broader pattern of combining 3D city data, point clouds, river observations, flood-inundation information, terrain, shelters, and live cameras in a 3D viewer. That is evidence for the value of a unified geospatial presentation, not evidence that Cesium Stories itself performs flood simulation or that TSM has those live integrations deployed. See [Tokyo Metropolitan Digital Twin 3D Viewer](https://cesium.com/blog/2024/04/04/tokyo-metropolitan-digital-twin-3d-viewer-uses-cesium/).

## Integration architecture

```text
Authoritative source adapters / validated model outputs
                    |
                    v
TSM provenance, validation, dataset and run manifests
                    |
          +---------+----------+
          |                    |
          v                    v
TSM-hosted OGC 3D Tiles     Approved presentation export
CesiumJS default runtime    (sanitized, versioned assets)
          |                    |
          v                    v
TSM public/private viewer   Optional Cesium ion Story
                              (account-backed)
```

### Required publication contract

Before any data is uploaded to an external Story workspace, create a publication manifest containing:

- TSM dataset ID and immutable version/snapshot ID.
- Source authority, source URL, acquisition timestamp, and attribution.
- SHA-256 digest of every exported source artifact and the export bundle.
- Horizontal CRS and vertical datum/units where relevant.
- Model name/version, configuration hash, input manifest hash, and run ID for simulated results.
- Validation status and explicit distinction between observed, derived, simulated, scenario, and regulatory data.
- Data classification, license/redistribution check, PII/sensitive-location review, and publication approval.
- Story URL/identifier only after an authorized user creates it; never fabricate an ID or embed URL.

A Story's visual state is not an integrity proof. The TSM manifest and evidence ledger remain the authoritative record.

## Security, licensing, and data-governance constraints

1. **Do not put secrets in Story assets or URLs.** Never export API tokens, private endpoints, credentials, environment variables, or signed URLs with durable access.
2. **Treat upload as an external disclosure.** Data uploaded to an ion account is stored in that account according to the documented workflow. Only publish data explicitly approved for that destination.
3. **Review access settings before sharing.** A shareable link is not a substitute for TSM authorization or classification. Re-check the Story's sharing state after edits.
4. **No sensitive or controlled data by default.** Do not upload parcel-owner PII, critical infrastructure details, restricted survey data, non-public operational feeds, or sensitive incident data without explicit authorization and a reviewed data-sharing basis.
5. **Verify terms and source licenses.** Cesium Stories, CesiumJS, Cesium ion hosting/processing, and third-party basemaps are distinct products/data sources. Do not infer that an open-source CesiumJS license grants rights to every hosted dataset or paid ion capability.
6. **No external embed until tested.** The official tutorial documents an embed option, but TSM should use a normal external link by default. Test CSP, framing policy, mobile behavior, accessibility, and content security before enabling any iframe integration.
7. **No correctness inference from rendering.** A 3D overlay can be visually compelling while its datum, terrain, flood boundary, or model assumptions are wrong. Display provenance and limitations in TSM independently of the Story.
8. **Offline operation remains independent.** A Story may depend on hosted content, account permissions, network access, and third-party services. The self-hosted CesiumJS/3D Tiles workflow must continue to work without ion.

## Repository artifacts added by this research change

- `packages/government/schemas/cesium-story-publication-manifest.schema.json` defines a strict JSON Schema 2020-12 contract for source/run provenance, SHA-256 artifact digests, CRS/datum, data classification, publication review, optional Story URL, and sharing/embed flags. Unknown properties are rejected; an approved publication requires reviewer identity/time and positive license, sensitive-data, and property-allowlist checks.
- `packages/government/schemas/cesium-story-publication-manifest.example.json` is a clearly marked, non-approved fixture. It uses illustrative identifiers and hashes only; it is not a real dataset or approval.

These are contracts and fixture data, not a claim that runtime publication, upload, or schema validation has already been wired into the console. CI results for this PR remain the validation gate.

## Suggested implementation sequence

### Phase 0 — no-account work (safe to do now)

- Keep the existing self-hosted CesiumJS and OGC 3D Tiles path as the default.
- Keep this decision record and the publication manifest schema/fixture under version control.
- Wire the schema into an automated validation test before enabling any export workflow.
- Add a static Story-link configuration field that is optional, validated as HTTPS, and disabled by default; do not add a live link until a Story is created and reviewed.
- Add a publication checklist and redaction/allow-list rules for exported properties.
- Test that builds and routes do not require any ion environment variable.

### Phase 1 — authorized account required

Only after an operator with an authorized Cesium ion account explicitly approves the target dataset:

- Create a Story manually in the Cesium ion UI.
- Upload only the approved export package.
- Add the provenance/limitations narrative and source attribution.
- Review the sharing mode and embed behavior.
- Record the Story URL and the exact export manifest in TSM.
- Re-run a public-data disclosure review before enabling external sharing.

This phase is not performed by this research change.

## Acceptance criteria

- [ ] Existing self-hosted CesiumJS route works with no ion token or account.
- [ ] CI and offline builds do not require a Story URL or ion secret.
- [ ] A publication manifest binds the exported artifact hashes to TSM source/run identifiers.
- [ ] Observed, derived, simulated, scenario, and regulatory layers remain distinguishable.
- [ ] Export rejects or flags disallowed fields and fails closed on unknown classification.
- [ ] A Story link is optional, HTTPS-only, and shown only after an authorized operator records it.
- [ ] No model result is described as validated solely because it is rendered in Cesium.
- [ ] External embed is disabled unless CSP, privacy, accessibility, and sharing tests pass.

## Known limitations and non-claims

- This research did not create a Cesium ion account, upload assets, create a Story, or verify a live Story URL.
- No hosted Cesium ion service, paid capability, token, or external account is added to TSM.
- Cesium Stories is a presentation/visualization workflow; scientific computation, spatial analysis, authoritative determinations, and evidence attestation remain separate TSM responsibilities.
- Availability, quotas, current terms, pricing, and product capabilities can change; verify current Cesium documentation and applicable agreements before a production deployment.

## Sources

- Cesium Stories overview: https://cesium.com/learn/ion/cesium-stories-overview/
- Stories tutorial: https://cesium.com/learn/ion/stories-introduction/
- Time-dynamic data tutorial: https://cesium.com/learn/ion/stories-time-dynamic/
- Cesium ion overview: https://cesium.com/learn/ion/
- Tokyo Metropolitan Digital Twin case study: https://cesium.com/blog/2024/04/04/tokyo-metropolitan-digital-twin-3d-viewer-uses-cesium/
- TSM self-hosted CesiumJS contract: https://github.com/ATphobia22/Tri-State-Systems-Manager/blob/main/docs/SELF-HOSTED-CESIUM-3D-TILES.md
- TSM 3D Tiles pipeline: https://github.com/ATphobia22/Tri-State-Systems-Manager/blob/main/docs/3d-tiles-hlod-pipeline.md
