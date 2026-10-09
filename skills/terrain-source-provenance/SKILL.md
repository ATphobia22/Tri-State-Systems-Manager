# Skill: Terrain Source and Datum Provenance

## Trigger
Use when acquiring, mosaicking, resampling, reprojecting, encoding, or comparing terrain/elevation products.

## Required evidence
- Source URL, source identifier, retrieval timestamp, source version, license, and checksum
- Source CRS and target CRS, coordinate epoch where applicable, axis order, and transformation operation
- Vertical datum, units, geoid model, and whether heights are orthometric or ellipsoidal
- Pixel size, resampling algorithm, no-data semantics, vertical uncertainty, and coverage bounds
- Parent artifact hashes and transformation software versions

## Procedure
1. Inspect source metadata before processing. Do not infer datum from geographic region or file extension.
2. Normalize no-data and sentinel values before interpolation; preserve missingness.
3. Record every CRS and vertical transformation explicitly. Never treat a horizontal CRS conversion as a vertical datum conversion.
4. Calculate output checksums from actual bytes after writing.
5. Compare coverage, resolution, elevation range, and vertical reference with independent metadata or checkpoints.
6. Label resampled, merged, Terrain-RGB, mesh, and simulated products as derived.
7. Surface provenance and quality limitations in both the UI and machine-readable manifests.

## Hard stops
Stop engineering-grade claims when datum, units, transformation, provenance, or validation checkpoints are unresolved. Visualization may remain available with an explicit screening-level label.
