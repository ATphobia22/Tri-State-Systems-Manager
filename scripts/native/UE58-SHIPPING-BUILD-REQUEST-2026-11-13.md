# UE5.8 Windows Shipping — operator-authorized verification request

Date: 2026-11-13
Target repository branch: main

## Reason

Trigger the repository's existing one-shot UE5.8 Windows Shipping workflow on
an authorized self-hosted Windows x64 runner with installed Unreal Engine 5.8.
This is a release **verification request**, not a declaration that the build
passed, that all required source data are present, or that the native
application is certified.

## Required independently inspectable evidence

- Runner preflight and exact Unreal/Cesium plugin versions
- Complete BuildCookRun / packaging transcript and resulting artifact hashes
- Immutable local TSMData manifest, SHA-256 files, horizontal/vertical datum and
  provenance headers
- Native executable launch on a clean, disconnected Windows 11 x64 system
- Headed terrain and 3D Tiles screenshots with hardware, FPS and VRAM metadata
- Explicit missing-evidence display for unavailable scientific source values

## Release boundaries

The full Posey inventory of 23,082 authoritative building footprints is
**not** the same as 23,082 verified building heights or meshes; the previously
inspected LiDAR run reported 2,566 unavailable heights. This one-shot build
request does not waive the building data gate, certify flood model predictions,
or constitute FEMA/survey/regulatory approval. Results must be recorded by
actual artifact receipts and independently reviewed before any release label.

The CI trigger is the exact commit-message marker [TSM-UE-PACKAGE]; the
workflow, runner and evidence checks own the result.
