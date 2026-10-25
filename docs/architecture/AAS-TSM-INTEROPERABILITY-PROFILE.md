# TSM Asset Administration Shell (AAS) Interoperability Profile

**Status:** application profile and implementation guidance; not a certification of IEC 63278 conformance.

## Purpose

Use the Asset Administration Shell (AAS) as an interoperable asset identity and lifecycle view. Keep the AAS profile separate from TSM's authoritative source records, engineering model inputs, solver outputs, and regulatory decisions.

Official references:

- [IDTA AAS specifications](https://industrialdigitaltwin.org/en/content-hub/aasspecifications) — metamodel, APIs, data specifications, security, and AASX package format.
- [IDTA submodel templates](https://industrialdigitaltwin.org/en/content-hub/submodels) — the official catalog and assigned template identifiers.
- [IEC 63278-1](https://webstore.iec.ch/) — AAS standard family; consult the current licensed text for normative conformance work.

## TSM application profile

Schema: `data/schemas/aas-asset-manifest-v1.schema.json`.

The profile requires:

- stable asset identity and explicit `assetKind` (`Type` or `Instance`);
- `derivedFrom` for instances referencing a type asset;
- a list of submodel references, each with an immutable `semanticId`, official template identifier/version when known, and an explicit aspect/viewpoint;
- optional source URI and SHA-256 content hash for evidence-linked payloads;
- an explicit human-governance boundary. No AAS object or submodel automatically grants a permit, signs a report, or establishes regulatory compliance.

This schema is a TSM-owned manifest profile, **not** the complete official AAS metamodel schema, a validator for all IDTA Submodel Templates, or proof of IEC/IDTA conformance. Before using a template-specific `templateId`, retrieve it from the current IDTA catalog and preserve its official identifier and semantic IDs. Do not infer mandatory cardinalities or ECLASS/IEC CDD IRDIs from local field names.

## Suggested submodel aspects

| Aspect | Purpose | Evidence boundary |
|---|---|---|
| Identification | Stable asset ID, global asset ID, type/instance link | Identity claims require source provenance. |
| Technical data | Units, ranges, design properties, source references | Values must carry units and source/version metadata. |
| Asset location | CRS, coordinates, vertical datum, survey/source references | Coordinates are not a certified survey unless supported by a qualified source. |
| Provision of 3D models | References to glTF, 3D Tiles, CAD or point-cloud artifacts | Hash and version the artifact; do not embed unbounded payloads in metadata. |
| Handover documentation | O&M manuals, drawings, approvals, inspection records | Preserve issuing authority and document status. |
| Trustworthiness / evidence | Provenance, validation status, run ID, hash, reviewer status | Hashes establish integrity only; they do not prove authenticity or admissibility. |

## Semantic and lifecycle rules

1. Preserve official `semanticId` values unchanged when creating a local instance of a published template. Local `idShort` names may differ only where the official template permits it.
2. Validate template-specific required fields/cardinality against the exact version of the official template; this general profile cannot replace that validation.
3. Keep Type specifications separate from Instance observations. Link instances to their type using `derivedFrom`; do not silently copy stale specifications into live telemetry.
4. Express measurement units and horizontal/vertical reference systems explicitly. TSM's project site uses a local engineering CRS/datum contract only when the source data supports it; never apply EPSG:2966 or NAVD88 indiscriminately to assets outside that domain.
5. Keep provenance and review state append-only or versioned. A SHA-256 checksum is not a digital signature; authenticated reviewer identity and signature verification must be implemented by the evidence/signing service.
6. Human authority remains final. AAS is an interoperability model, not a governance engine.

## Adoption gates

- [ ] Pull the current official AAS metamodel and validate sample packages with a maintained AAS validator.
- [ ] Pin exact IDTA Submodel Template IDs and versions from the official catalog.
- [ ] Add template-specific schemas only after their cardinalities and semantic IDs are verified.
- [ ] Test serialization, round-trip preservation of semantic IDs, and Type/Instance links.
- [ ] Confirm access-control and signing behavior before attaching restricted or signed evidence.
