# TSM immutable offline asset chunks

Status: lossless release packaging only. A chunk integrity check does not
certify elevation accuracy, geodetic control, or 23,082 source buildings.

## Distribution strategy

GitHub source history is for code, manifests and small text datasets. GitHub
blocks normal Git objects larger than 100 MiB and recommends external artifact
storage for generated binaries. Git LFS pointers also do not work directly
in GitHub Pages. Use CI artifacts or signed releases for large datasets.

Use authoritative LAS/LAZ/COPC source files with their original SHA-256s and
datum metadata. Keep a lossless geodetic/mesh evidence master. Draco, meshopt
or geometry quantization may be used only for separately labeled
visualization derivatives after identity and geometry-tolerance validation.

TurboVec is an approximate vector-search quantizer, not a lossless mesh or
point-cloud archival format and cannot replace COPC, LAS/LAZ, GLB or the
source file evidence needed by TSM.

## Package verified countywide tiles

After ALL authoritative identity, LiDAR height, HLOD, topology and OGC 3D
Tiles validators pass, run this exact bounded-memory procedure:

    python3 scripts/release/chunk_offline_assets.py pack \
      --input-dir /tmp/tsm-buildings/implicit \
      --output-dir /tmp/tsm-artifacts/tsm-3d-tiles-parts \
      --compression none \
      --part-bytes 25165824

    python3 scripts/release/chunk_offline_assets.py verify \
      --manifest /tmp/tsm-artifacts/tsm-3d-tiles-parts/manifest.json

    python3 scripts/release/chunk_offline_assets.py unpack \
      --manifest /tmp/tsm-artifacts/tsm-3d-tiles-parts/manifest.json \
      --output-dir /tmp/tsm-3d-tiles-restored

Use gzip compression for text-heavy evidence; use none for already Draco/
meshopt-compressed GLBs. This implementation creates deterministic tar
streams with normalized tar timestamps, archive file ordering and gzip mtime
zero. Each chunk is 24 MiB maximum by default; no full archive resides
in RAM.

The small manifest records input-relative paths, byte counts, per-file
SHA-256, complete archive SHA-256, and independently verifiable chunk sizes
and hashes. Publish all chunks and manifest as a GitHub Actions artifact or
GitHub Release attachments. Do NOT commit them individually to Git history.
Do not rename parts or edit manifest hashes.

Unpack verifies all chunks before restoring, refuses symlinks, absolute and
traversing paths, duplicate/unknown tar entries, and overwrite of an
existing destination. It recomputes source file SHA-256 while restoring
and publishes nothing on failed verification.

## Acceptance and governance

The packer must never run before valid building content is accepted. The
county target requires 23,082 distinct, authoritative IGIO source OBJECTIDs,
explicit OBSERVED/DERIVED height metadata and datum/units, valid topology,
valid implicit and HLOD hierarchy, and complete glTF/3D Tiles validation.
If that chain fails, Twin Canvas must retain PARTIAL_SOURCE_UNVERIFIED.

This protocol distributes immutable files; it does not build a Unreal
Engine 5.8 Shipping executable. Packaged Unreal assets must still be
cooked in the UE editor and verified on Windows 11 x64 with offline assets
and cinematic rendering. Regulatory/survey findings require separate review.

## References

- https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage
- https://docs.ogc.org/cs/22-025r4/22-025r4.html
- https://github.com/KhronosGroup/glTF/tree/main/specification/2.0
