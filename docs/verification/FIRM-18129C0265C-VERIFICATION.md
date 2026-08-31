# FIRM 18129C0265C Verification Record

## Source artifacts received

| Artifact | SHA-256 | Status |
|---|---|---|
| `18129C0265C.jpeg` | `f7d6bfe398f92f7d7f8c1dc0e97f9adf1191dd074b2ca7370ddcededd373f978` | registered source artifact |
| `18129C0300C.pgw` | `b79280265b7461f5ab161ed304c0a331fed9b077febc1df9d3bf0d56e6815a14` | rejected for panel 18129C0265C |
| `18129C0255C.pgw` | `fb099f52ae541cac0cdcd76429d31cc9c022eff00dbb8b46e8004cffbd94ca45` | rejected for panel 18129C0265C |

## Validation results

- Panel identity: `18129C0265C` — recorded from the supplied map panel.
- Effective date visible on supplied panel: `2014-11-05`.
- Raster dimensions: `1536 × 1103` pixels.
- World-file parsing: implemented and tested for six-parameter ESRI affine transforms.
- Candidate world-file association: **failed closed** because the supplied PGW filenames identify different panel numbers.
- Local derived georeferencing: **not published**.
- Public derived FIRM layers: **blocked** until authoritative FEMA georeferencing is reconciled.
- Grant/hazard linkage: evidence-reference only; unsupported regulatory and eligibility conclusions remain blocked.

## Automated test evidence

A local Node.js `node:test` harness was executed against the implemented world-file parser, association validator, source manifest loader, and public-layer gating logic.

Result: **4 tests, 4 passed, 0 failed**.

The repository CI workflow additionally executes the FIRM test suite and manifest-governance checks on pull requests and relevant pushes.

## Important limitation

The binary source image and PGW files are conversation-uploaded source artifacts. Their exact SHA-256 values are recorded in the repository, but this GitHub integration path cannot directly attach arbitrary binary conversation uploads to the repository. The system therefore does not pretend the repository contains the binary source bytes. The source bundle remains available from the originating conversation attachment and is represented in-repository by its immutable identifiers and hashes.

This limitation is deliberate rather than silently substituting or recompressing the source image.
