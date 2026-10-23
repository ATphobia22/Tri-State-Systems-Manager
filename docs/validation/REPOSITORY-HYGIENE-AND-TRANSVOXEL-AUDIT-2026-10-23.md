# Repository hygiene and Transvoxel correctness audit — 2026-10-23

## Scope

This pass is based on main commit `110bc489acfd170e90f3949c1547f68c63dfdf90` and is implemented on a separate review branch. No production files, reference data, terrain tiles, or duplicate assets were deleted.

## Confirmed code defect fixed in this change

The official Transvoxel lookup tables use a non-row-major case-bit assignment for the nine row-major high-resolution face samples:

`[0x001, 0x002, 0x004, 0x080, 0x100, 0x008, 0x040, 0x020, 0x010]`

Previously the Python and TypeScript implementations used `1 << sampleIndex`. That incorrectly indexed `transitionCellClass[512]` and `transitionVertexData[512][12]`. For sign arrangements in which sample index 3, 4, or later positions crossed case-bit order, table edges could connect endpoints with the same sign. A neighbouring-cell seam test on main exposed the result.

Changes in this branch:
- Use the official case-bit mapping in Python and TypeScript.
- Validate all 512 row-major sign arrangements against the table: every emitted edge must connect opposite-sign scalar samples, including coarse-side endpoints whose values reuse fine-face corners `[0, 2, 6, 8]`.
- Keep the adjacent-cell shared-plane seam test, rather than relaxing it.
- Update the Python exhaustive self-test to assert the canonical case index instead of assuming the row-major mask equals the lookup-table index.

References:
- Eric Lengyel’s published tables and their endpoint numbering: https://github.com/EricLengyel/Transvoxel/blob/main/Transvoxel.cpp
- Algorithm overview: https://transvoxel.org/
- A second implementation showing the nine-point sample grid, official case-bit map, 13 transition points, and endpoint decoding: https://github.com/danielsobrado/drusniel-voxels-bevy/blob/main/src/voxel/mc_transvoxel/transvoxel.rs

## Safe ignore-rule improvements

Added ignore patterns for Cargo/Tauri `target/` output; pytest, mypy, Ruff and Hypothesis caches; tox output; and coverage artifacts. These patterns prevent new generated/local files from entering future commits. They do not untrack files already committed.

## Hygiene findings and deletion decisions

A recursive main-tree scan returned a non-truncated tree of approximately 10.5k entries. The tracked-path scan found no obvious files under common Node/Python build directories and no tracked names matching the audited temporary, cache, editor-backup, or build-info patterns.

The scan found 68 groups of identical blob hashes. Repeated content includes 3D Tiles subtree binaries/manifests, duplicated reference PDFs, geometry/schema mirrors, and packaging assets. Byte equality alone does not establish that these references are redundant. **No duplicate files were deleted.** Their runtime, packaging, data-provenance, and downstream references need path-by-path confirmation first.

No dead-code removal is claimed. The TypeScript project currently allows unused locals, and code-name/path heuristics are insufficient to prove that public APIs, dynamic imports, CLI entry points, test fixtures, or geospatial reference assets are unreferenced.

## Release status

The Python and TypeScript test suites in the affected geospatial workflow are expected to verify this change on the PR head. No success is inferred from writing the tests. The change must not be merged until the exact-head geospatial workflow, full CI, production build, and security checks complete successfully.

Physical WebGPU performance, context-loss recovery on actual devices, and any design/model approval remain separate evidence gates; this hygiene and case-index correction does not certify them.
