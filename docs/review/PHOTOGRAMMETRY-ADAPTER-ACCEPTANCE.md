# Review-only openMVG to MicMac photogrammetry adapter

## Scope
Headless conversion of the owner's supplied openMVG sfm_data.json proposal to MicMac-style XML and SHA-256 receipts. No external photogrammetry tools are installed, executed or shipped. Outputs are DERIVED, and carry `micmac_runtime_validated=false` and `geodetic_control_validated=false`; CRS and datum strings are operator declarations, not surveyed-control evidence.

## Corrections
- Brown distortion `pinhole_brown_t2` is rejected, not silently reduced to radial coefficients.
- Guard non-finite and invalid 3x3 camera rotations, image dimensions, focal and radial distortion coefficients, centers and missing poses.
- Reject unsafe/duplicate filenames and non-numeric intrinsic IDs before creating output paths.
- SHA-256-bind the input file and every orientation and calibration XML output.

## Not installed or certified
The uploaded PDAL GEOID18 recipe incorrectly defines the Indiana West false northing as zero. EPSG:2966 specifies approximately 820208.333 US survey feet. GEOID18 requires appropriate NAD83(2011) reference coordinates; `EPSG:4979` alone is not proof of compatible realization or epoch. The supplied Unreal Engine 5.8 plugin has not passed a Windows UHT/MSVC compile or verified tileset byte hashing, offline path restrictions or clean Windows 11 Shipping runtime. The STAC schema and tile builder remain proposals.

## Required acceptance
Run synthetic tests in CI, then real openMVG/MicMac image-set roundtrip with reprojection residuals, verified geodetic control/vertical datum, validated 3D Tiles and STAC receipts, and independent network-disabled Windows Shipping acceptance.

## Primary references
- https://openmvg.readthedocs.io/en/latest/openMVG/sfm/sfm/
- https://github.com/micmacIGN/Documentation
- https://epsg.io/2966
- https://geodesy.noaa.gov/GEOID/GEOID18/
- https://cdn.proj.org/
