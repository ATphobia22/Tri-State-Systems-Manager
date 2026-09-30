# AWS Spatial Source Register

The following supplied sources were reviewed as architectural references on 2026-09-30. No proprietary implementation was copied into TSM.

| Source | Reused concept |
|---|---|
| https://aws.amazon.com/blogs/iot/convert-gltf-to-3d-tiles-for-streaming-of-large-models-in-aws-iot-twinmaker/ | glTF/GLB → 3D Tiles, spatial HLOD, streamed large-model hierarchy |
| https://docs.aws.amazon.com/location/latest/developerguide/tiles.html | XYZ tile addressing, tile metadata/cache semantics |
| https://aws.amazon.com/location/maps/ | dynamic/static map separation, map styles, terrain/contour presentation |
| https://docs.aws.amazon.com/location/latest/developerguide/styling-dynamic-maps.html | style descriptors and zoom-dependent presentation |
| https://docs.aws.amazon.com/location/latest/developerguide/static-maps.html | deterministic static snapshots and GeoJSON overlays |
| https://docs.aws.amazon.com/quick/latest/userguide/base-maps.html | explicit base-map selection |
| https://docs.aws.amazon.com/quick/latest/userguide/layered-maps.html | independently managed shape/layer overlays |
| https://docs.aws.amazon.com/quick/latest/userguide/geospatial-charts.html | geospatial visualization semantics and geographic hierarchies |
| https://aws.amazon.com/blogs/physical-ai/building-spatial-simulations-with-generative-agents-using-amazon-bedrock-agentcore/ | deterministic runner + constrained agent decisions + validated world-state transactions + snapshots |
| https://aws.amazon.com/blogs/gametech/splitting-the-atom-introducing-lumberyards-new-photorealistic-renderer/ | modular PBR, GPU-aware rendering and cinematic presentation architecture |
| https://github.com/aws-samples/aws-iot-twinmaker-samples | TwinMaker scene/component/sample organization |
| https://github.com/aws-solutions-library-samples/guidance-for-industrial-digital-twin-on-aws | industrial digital-twin data/scene integration patterns |
| https://github.com/aws-samples/twinmaker-dynamicscenes-crossdock-demo | dynamic-scene/state-driven visualization pattern |

AWS Marketplace product URLs supplied in the research set are retained as external references only. Their product identifiers are not treated as TSM dependencies or authoritative sources.
