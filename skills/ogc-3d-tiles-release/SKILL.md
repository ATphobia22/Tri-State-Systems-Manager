# Skill: OGC 3D Tiles Release Verification

## Trigger
Use when changing, building, publishing, or troubleshooting terrain/building OGC 3D Tiles or the self-hosted CesiumJS runtime.

## Required inputs
- Source dataset manifest and SHA-256 inventory
- Tileset build script and output directory
- Tileset validator and browser smoke test
- Target publication base path

## Procedure
1. Verify source authority, acquisition date, licensing, horizontal CRS, vertical datum, units, and transformation history.
2. Build from pinned tool versions; do not use undocumented manual edits to generated tiles.
3. Validate the tileset JSON, OGC 3D Tiles version, bounding volumes, geometric error, content references, GLB structure, and all referenced files.
4. Verify every content reference resolves within the output tree; reject path traversal, missing content, empty content, and unreferenced checksum entries.
5. Run the renderer smoke test against the actual CesiumJS runtime and published-base-path URL.
6. Verify generated Cesium workers, assets, widgets CSS, tileset JSON, tile content, and SHA-256 manifests exist in the deployment artifact.
7. After deployment, fetch the public tileset and a representative content tile; compare the published hashes against the release manifest.

## Safety invariants
- A successful build is not proof of a successful public deployment.
- Terrain derived from USGS 3DEP remains a visualization derivative unless separate survey/control validation establishes otherwise.
- Do not claim NAVD88-to-ellipsoid conversion unless a named geoid model, coordinate operation, epoch, and validation evidence support it.
- Keep visual availability separate from engineering/regulatory authority gates.
