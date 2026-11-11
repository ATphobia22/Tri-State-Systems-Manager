# TSM GeoBIM open-source adoption — 2026-11-11

## Scope and outcome

Seven [ATphobia22 GitHub forks](../../integrations/geobim-oss-candidates.v1.json) were reviewed by repository metadata for upstream identity, pinned fork main commit and top-level reported license. This is a candidate register, **not** a vendor import or evidence of geospatial accuracy. No external project is vendored or installed by this PR.

The canonical implementation remains the existing **native UE5.8 + local TSMData** path. The repository already has MapLibre, Cesium/3D Tiles, PostGIS/geospatial pipelines, CityJSON conversion and geodesy contracts. Avoid adding duplicate map engines or a web runtime to a desktop-native Shipping target.

| Fork | Upstream | License shown by GitHub | Decision |
|---|---|---|---|
| [xtool](https://github.com/ATphobia22/xtool) | xtool-org/xtool | MIT | Separate iOS CI evaluation; not a Windows build dependency |
| [map3d](https://github.com/ATphobia22/map3d) | cartesiancs/map3d | MIT | Inspect procedural building/road scene algorithms; no unverified geometry in TSMData |
| [img2threejs](https://github.com/ATphobia22/img2threejs) | img2threejs/img2threejs | Apache-2.0 | Artistic reference meshes only, labeled DERIVED |
| [artcraft](https://github.com/ATphobia22/artcraft) | storytold/artcraft | Apache-2.0 | Offline cinematic authoring reference, not scientific evidence |
| [rea](https://github.com/ATphobia22/rea) | morluto/rea | MIT | Exclude from production runtime; independent security/legal review before research |
| [ingetrazo](https://github.com/ATphobia22/ingetrazo) | ingelibre/ingetrazo | GPL-3.0 | Standalone BIM-authoring evaluation with redistribution obligations reviewed |
| [openBIMstudio](https://github.com/ATphobia22/openBIMstudio) | amdghedy/openBIMstudio | MIT | Promising isolated BIM authoring / IFC/BCF coordination reference |

## Recommended contract boundary

```text
Operator-reviewed IFC / IFCZIP / CityJSON / LAS / LAZ source
    -> source catalog: source ID, exact byte SHA-256, license, dates,
       horizontal CRS, vertical datum, units, authority classification
    -> offline source-byte intake (implemented for plain .ifc only)
    -> optional reviewed IfcOpenShell geometry/IFC-schema validation (NOT implemented)
    -> explicit engineering CRS transform through PROJ and geoid grids (NOT implemented here)
    -> asset identity join and independent geometry QA (NOT implemented here)
    -> existing TSM CityJSON / 3D Tiles / Unreal staging
    -> manifest checksums and headed native Windows Shipping verification
```

The new `scripts/geospatial/verify_geobim_ifc_intake.py` checks only plain IFC STEP file prefix, declared metadata, exact source SHA-256, and safe no-overwrite receipt creation. It rejects missing vertical datum and unsupported authority claims, and explicitly sets `ifcSchemaValidated`, `georeferenceVerified`, `surveyCertified`, `regulatoryApproved`, and `nativeShippingVerified` to false. A format prefix alone cannot prove an IFC file is well formed.

Example operator-supplied `source.json` (the digest shown here is a **placeholder**; replace with the real SHA-256):

```json
{
  "sourceId": "operator-bim-model-001",
  "expectedSha256": "<64-hex-source-digest>",
  "horizontalCrs": "EPSG:2966",
  "verticalDatum": "NAVD88",
  "units": "ftUS",
  "license": "reviewed-source-license",
  "authorityClass": "CANDIDATE"
}
```

```bash
python3 scripts/geospatial/verify_geobim_ifc_intake.py \
  --ifc /local/approved/model.ifc \
  --metadata /local/approved/source.json \
  --receipt /local/receipts/model-intake.json
python3 -m unittest scripts/geospatial/test_verify_geobim_ifc_intake.py -v
node --test tests/contracts/geobim-oss-candidates.test.mjs
```

## Design decisions

- **IfcOpenShell**: first external adapter candidate. Its official API supports IFC georeferencing and `IfcMapConversion`. Pin package and component-specific LGPL/licensing review. Test at least one local and one projected IFC fixture, axis order, units, false-easting, world placement, elevation reference, and mesh identity. See https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/georeference/index.html and https://github.com/IfcOpenShell/IfcOpenShell .
- **CityJSON**: use its official 2.0.2 specification and existing TSM converter as interchange, with CRS/geometry semantic validation. Specification: https://www.cityjson.org/specs/ .
- **PDAL and Potree**: consider for bounded offline LiDAR point-cloud inspection, avoiding any increase in the native runtime dependency graph until memory/performance benchmarks and redistribution review succeed.
- **xeokit**: license hold, not an implicit replacement for MapLibre or Cesium. The current xeokit SDK is AGPL-3.0 according to upstream docs; embedding has copyleft implications requiring deliberate review. https://xeokit.github.io/xeokit-sdk/docs/ .
- **OpenBIMstudio / Ingetrazo**: authoring and BCF workflows are not equivalent to evidence-approved source geometry. Review each exact fork revision's build and dependencies independently.
- **img2threejs / artcraft / map3d**: cinematic or synthetic geometry is labeled *DERIVED*; it cannot substitute for IGIO lidar, FEMA products, engineering surfaces, or a survey.

## Acceptance checks before runtime integration

1. Record canonical project, exact version/commit, full license text and notices, reproducible build, SBOM and vulnerability assessment.
2. Require explicit operator provenance, EPSG horizontal CRS and actual vertical datum/units. Reject implicit NAVD88, geoid-agnostic ECEF, or assumed project transforms. A declared value is not a verified transform.
3. Reconcile every candidate building feature to the official Posey County source identifier and demonstrate the expected 23,082-source completeness independently of any artist-created model.
4. Test IFC/CityJSON conversion for entity IDs, geometry winding, large local coordinates, origin-rebasing, feet-to-meter conversion and vertical alignment.
5. Only after independent geometry and datum checks should assets be staged to UE5.8 World Partition / 3D Tiles, with offline TSMData hashes and headed packaged Shipping evidence.
6. Do not mark a dataset, model output, grant recommendation, hazard boundary or flood elevation as regulatory/agency-certified based on visual plausibility.

## Limits

No new dependencies, external network services, runtime menus, Unreal meshes, BIM viewer, native cooker, full IFC parser or authoritative spatial survey have been implemented in this change. Only the intake checker, candidate register, documentation, and automated tests are delivered.
