# TSM Open-Source Engineering Ecosystem Integration Matrix

**Research date:** 2026-09-29  
**Canonical operator runtime:** Unreal Engine 5.8 native application  
**Policy:** external repositories are capability sources/adapters, not arbitrary runtime dependencies.

## Architectural rule

`External repository -> isolated adapter/worker -> versioned TSM contract -> Evidence/Engineering/Presentation plane`

No repository is absorbed wholesale unless its license, provenance, maintenance state, build reproducibility, security boundary, and runtime suitability are explicitly accepted.

## High-value capability map

| Repository | Capability | TSM application | Integration boundary |
|---|---|---|---|
| OpenWorldLib | world-model research, 3D generation, perception, reasoning, VLA, memory | optional AI-assisted scene understanding, semantic world interrogation, future scenario perception | offline model worker; never authoritative engineering truth |
| UniversalSceneDescription | OpenUSD/.NET packaging and native runtime | USD scene exchange, artifact manifests, cross-platform scene interchange | artifact/export worker |
| box3d-unity | deterministic 3D physics and scene queries | research for deterministic rigid-body interaction and test methodology | reference only; Unreal physics remains canonical |
| openpencil | programmable node-tree design, CLI, MCP, design-as-code | engineering diagram/layout generation, HUD/design artifact authoring, reviewable visual specifications | design-tool adapter; not operator runtime |
| openshot-qt | open-source video editing | automated engineering briefing/editing pipeline | offline media worker |
| OpenCAD | parametric CAD, feature DAG, constraints, OCCT STEP/STL, design artifacts | berm/road/structure parametric design and native CAD artifact generation | isolated CAD worker + TSM Design IR |
| openml-python | dataset discovery, ML experiment/data API | benchmark/evaluation datasets and model provenance | research/benchmark worker; no authority over engineering datasets |
| eslint-config-natron | JS/TS lint conventions | quality reference only | no runtime dependency |
| natron-cli | compositing automation | batch post-processing of engineering/cinematic renders | optional offline compositor adapter |
| paperbanana | document/visual generation research | automated technical report/figure composition | document worker; outputs evidence-bound artifacts |
| nutron | Natron ecosystem component | investigate only if concrete automation capability is needed | research-only until provenance/licensing verified |
| natron-plugins | OpenFX plugin collection | post-production effects, image processing | external compositor boundary |
| Natron-Lens-Flare-Studio | lens-flare presets/tools | cinematic post-production preset research | external compositor boundary |
| openfx-arena | OpenFX effects incl. PDF/text/edges/morphology/OCL | post-process engineering/cinematic imagery | external OFX boundary; license review required |
| NatronGitHub.github.io | Natron documentation/site | documentation reference | no runtime dependency |
| bpy | Blender Python API | procedural geometry, conversion, batch scene authoring | offline Blender worker |
| blender-mcp | AI-controlled Blender workflows | automated CAD/terrain/visual artifact preparation | sandboxed DCC worker |
| blender | Blender | procedural modeling, rendering, geometry conversion, validation | offline DCC worker |
| BlenderGIS | GIS import/georeferencing/terrain analysis | offline geospatial preprocessing, terrain mesh checks, georeferenced camera preparation | data-prep adapter; authoritative data remains TSM evidence catalog |
| PDF-Importer-Blender | high-fidelity PDF vector/text import | engineering drawings -> geometry/annotation ingestion | offline document-to-geometry adapter |
| TrailPrint3D | GPX/elevation/map -> 3D printable terrain | physical terrain model generation and community fabrication | artifact generator; not engineering authority |
| unity-realtime-networking-client | Unity networking | networking architecture research | not native TSM runtime |
| OpenFOAM-dev | CFD/multiphysics | future local hydraulic/aerodynamic/thermal validation where HEC-RAS/MODFLOW are insufficient | isolated solver worker; GPL boundary |
| awesome-unity3d | ecosystem catalog | discover additional algorithms/tools | research index only |
| unity-gaming-services-cli | Unity service automation | deployment/process research | not needed for native offline TSM |
| unity | Unity engine source | comparative engine/reference research | reference only; licensing/source restrictions |
| cesium-unity | globe/3D Tiles geospatial workflows | validates cross-engine geospatial patterns; informs Cesium for Unreal implementation | research/reference; Unreal Cesium remains runtime path |
| arcgis-maps-sdk-unity-samples | GIS/ArcGIS interaction patterns | geospatial UX/reference patterns | reference only; no Unity runtime |
| opencv | CV, calibration, image processing, reconstruction | photogrammetry QA, camera calibration, object/terrain inspection, visual evidence extraction | native/plugin or isolated C++ worker |
| MagicOnion | typed realtime RPC over gRPC/MessagePack | optional collaborative/offline-lab RPC architecture | future service fabric; not required for single-device simulation |
| overte | self-hosted virtual worlds, physics, scripting, collaboration | multiplayer/community-world research and interaction patterns | research only; conflicts with native offline product boundary |
| mattermost | self-hosted collaboration/workflows | community engineering review, incident/change workflows, evidence discussion | external collaboration service |
| OpenBLAS | optimized BLAS/LAPACK numerical kernels | high-throughput matrix operations, solvers, calibration/optimization | numerical worker/native dependency |
| openstreetmap-ng | OSM data/platform | local OSM extraction/metadata reference | geodata ingestion boundary |
| osrm-backend | OSM routing, nearest/match/table/trip/tile | road access, evacuation, construction logistics, alignment context | isolated routing service |
| Natron | node compositing, OCIO, OFX, headless render | cinematic engineering presentation/post | offline post-production worker |
| OCCT | B-rep geometry, STEP/IGES, topology/shape healing | precise engineering solids, CAD exchange, design validation | native/isolated CAD kernel |
| unity-mcp | AI/editor automation patterns | safety-gated editor automation reference | reference only; Unreal automation must remain native and policy-gated |
| Blender_GES_Import | camera/trackpoint/rendered-image import | georeferenced cinematography/camera-track methodology | offline camera-artifact adapter |

## Priority tiers

### Tier 1 — integrate behind real contracts

1. **OpenCAD + OCCT** — parametric engineering geometry.
2. **OpenUSD** — scene/design interchange.
3. **BlenderGIS** — offline GIS/terrain preprocessing.
4. **OpenCV** — inspection/calibration/computer vision.
5. **OpenBLAS** — numerical acceleration.
6. **OSRM** — transportation/access analysis.
7. **OpenFOAM** — future high-fidelity CFD worker.
8. **Natron/OpenFX** — cinematic/post-production worker.

### Tier 2 — controlled research adapters

- OpenWorldLib
- bpy/Blender
- blender-mcp
- OpenPencil
- PDF-Importer-Blender
- TrailPrint3D
- paperbanana
- MagicOnion
- Mattermost
- Overte
- Cesium Unity
- ArcGIS Unity samples
- Box3D Unity
- Unity networking/services/editor repositories

### Tier 3 — reference/catalog only

- awesome-unity3d
- eslint-config-natron
- Natron website/docs
- small Nutron/Natron utility repositories without a demonstrated TSM capability

## License/provenance gates

- OpenWorldLib: Apache-2.0. urlRepositoryhttps://github.com/OpenDCAI/OpenWorldLib
- OpenPencil: MIT. urlRepositoryhttps://github.com/open-pencil/open-pencil
- UniversalSceneDescription: MPL-2.0; its bundled OpenUSD is under Modified Apache 2.0. urlRepositoryhttps://github.com/EggyStudio/UniversalSceneDescription
- OpenFOAM Foundation development code: GPL; keep it outside a proprietary/native executable boundary unless the complete licensing consequences are accepted. urlRepositoryhttps://github.com/OpenFOAM/OpenFOAM-dev
- OpenCV 4.5+ is Apache 2.0; older releases differ. Pin a modern audited version. urlLicense informationhttps://opencv.org/license/
- BlenderGIS is GPL: use as an external preprocessing tool unless the distribution/licensing model is explicitly approved. urlRepositoryhttps://github.com/domlysz/BlenderGIS
- Natron/OpenFX ecosystems contain GPL/LGPL components; treat them as external post-processing tooling rather than embedding them into the native TSM executable. urlNatronhttps://github.com/NatronGitHub/Natron
- Unity C# reference source is reference-only and carries Unity-specific restrictions; do not copy Unity source into TSM. urlUnity C# reference sourcehttps://github.com/Unity-Technologies/UnityCsReference
- Every dependency entering a distributed TSM artifact must receive an SPDX/license/SBOM/provenance review before packaging.

## Core innovation conclusion

The most powerful architecture is **not** one monolithic application containing all of these projects. TSM should become a native engineering operating environment with:

- Unreal for world interaction/rendering.
- TSM Evidence Plane for authoritative geospatial/scientific truth.
- TSM Design IR for engineering intent.
- OpenUSD for scene interchange.
- OCCT/OpenCAD for precise parametric geometry.
- OpenBLAS for numerical kernels.
- OpenCV for perception/inspection.
- OSRM for transportation context.
- OpenFOAM/HEC-RAS/MODFLOW adapters for specialized physical models.
- BlenderGIS/Blender for offline conversion and content preparation.
- Natron/OpenFX/FFmpeg/OpenShot for offline cinematic finishing.
- OpenWorldLib and ML tooling for non-authoritative perception/reasoning assistance.
- Mattermost as an optional human collaboration layer, never as a simulation dependency.

This preserves the native-only product requirement while making the system extensible enough to become a community-scale engineering platform.
