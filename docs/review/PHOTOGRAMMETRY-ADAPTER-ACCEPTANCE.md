# Review-only openMVG to MicMac photogrammetry adapter

## Scope
Headless conversion of the owner's supplied openMVG sfm_data.json proposal to MicMac-style XML and SHA-256 receipts. The adapter runs without external dependencies. A separate test exercises the upstream MicMac binary. Outputs are DERIVED, and individual conversions carry `micmac_runtime_validated=false` and `geodetic_control_validated=false`; CRS and datum strings are operator declarations, not surveyed-control evidence.

## Corrections
- Brown distortion `pinhole_brown_t2` is rejected, not silently reduced to radial coefficients.
- Guard non-finite and invalid 3x3 camera rotations, image dimensions, focal and radial distortion coefficients, centers and missing poses.
- Reject unsafe/duplicate filenames and non-numeric intrinsic IDs before creating output paths.
- SHA-256-bind the input file and every orientation and calibration XML output.

## Not installed or certified
The uploaded PDAL GEOID18 recipe incorrectly defines the Indiana West false northing as zero. EPSG:2966 specifies approximately 820208.333 US survey feet. GEOID18 requires appropriate NAD83(2011) reference coordinates; `EPSG:4979` alone is not proof of compatible realization or epoch. The supplied Unreal Engine 5.8 plugin has not passed a Windows UHT/MSVC compile or verified tileset byte hashing, offline path restrictions or clean Windows 11 Shipping runtime. The STAC schema and tile builder remain proposals.

## Real-camera projection test

The original conversion failed MicMac v1.2.0 XML validation because
`Externe/KnownSize` is unsupported and the generated `Verif` omitted the
required control observations. The adapter now omits those fields and marks
the calibration filename relative to the orientation file.

Using the pinned openMVG viewer sample, MicMac v1.2.0 XYZ2Im evaluated 22,564
image observations across all 11 real camera poses from a different working
directory. The maximum difference between MicMac and the openMVG pinhole
radial projection equations was 0.0000378 px. The RMS residual to the
sample's observed pixel positions was 0.6325 px. The workflow reruns this
test with SHA-256-verified source and binary inputs.

## Remaining scene acceptance

Surveyed geodetic control and the vertical datum remain unverified, along
with downstream STAC and 3D Tiles, and network-disabled Windows Shipping.
The transferable projection result applies to the pinned sample and model.

## Primary references
- https://openmvg.readthedocs.io/en/latest/openMVG/sfm/sfm/
- https://github.com/micmacIGN/Documentation
- https://epsg.io/2966
- https://geodesy.noaa.gov/GEOID/GEOID18/
- https://cdn.proj.org/
