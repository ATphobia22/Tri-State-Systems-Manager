# terrain-gpu (archived source of truth)

**Authority:** PRESENTATION_ONLY / OPERATIONS_REPORT  
**Policy:** Human authority remains final.

## Requirements

### Requirement: Hierarchical-Z Presentation Assist
The system SHALL provide a max-filter Hierarchical-Z depth pyramid for presentation occlusion assist, with a deterministic CPU reference path and an optional WebGPU compute path.

#### Scenario: CPU pyramid matches 2x2 max reduction
- GIVEN a finite depth buffer of known size
- WHEN `buildHiZPyramidCpu` runs
- THEN coarser levels store the max of each 2×2 neighborhood and authority is PRESENTATION_ONLY

#### Scenario: Context loss fails closed to CPU
- GIVEN no GPU device or a lost WebGPU session
- WHEN `integrateHiZWithRenderer` is invoked
- THEN the system returns a CPU-reference pyramid and does not reuse destroyed GPU objects

### Requirement: Transvoxel LOD Seam Checks
The system SHALL discover shared LOD tile boundaries and measure seam residual in metres against a stated tolerance.

#### Scenario: Representative AOI run
- GIVEN a checkerboard fine/coarse LOD lattice over a local-metre AOI
- WHEN `runRepresentativeAreaStitch` completes
- THEN edges are checked, elapsedMs is recorded, and continuous analytic surfaces pass within tolerance

### Requirement: AOI Coverage Fail-Closed
The system SHALL treat unknown coverage cells as nodata and MUST NOT invent published tile endpoints during provider recovery.

#### Scenario: No published provider
- GIVEN only PROGRAM_PENDING terrain providers
- WHEN provider recovery runs after failure
- THEN `activeProviderId` is null and `failClosed` is true

### Requirement: CRS and Vertical Datum Evidence
The system SHALL evaluate the supported source catalog for horizontal CRS, vertical datum, and provenance and flag missing critical metadata.

#### Scenario: Missing datum is critical
- GIVEN a catalog row without vertical datum
- WHEN evidence is evaluated
- THEN status is MISSING_CRITICAL

### Requirement: Cross-Device Validation Honesty
The system SHALL define a representative desktop/mobile device matrix and MUST record live FPS/memory only when measured on hardware.

#### Scenario: CI without devices
- GIVEN no attached GPU device lab results
- WHEN the cross-device report is built
- THEN measurements are PENDING_OPERATOR and allDevicesMeasured is false

## Code paths

- `tsm-console/src/gpu/hierarchical-z.ts`
- `tsm-console/src/gpu/hierarchical-z.wgsl`
- `tsm-console/src/gpu/transvoxel-stitch.ts`
- `tsm-console/src/lib/terrain-coverage.ts`
- `tsm-console/src/lib/crs-vertical-datum-evidence.ts`
- `tsm-console/src/lib/cross-device-validation.ts`
- `contracts/registries/tsm-terrain-aoi-coverage-manifest-v1.json`
