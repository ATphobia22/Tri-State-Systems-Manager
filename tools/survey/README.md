# Offline survey interchange and computations

This is a Python preprocessing tool for TSM, not a new runtime dependency of the native Unreal executable. No agency or survey certification is inferred. Source geometry and observation evidence remain separate from presentation outputs.

## Run

```bash
python -m pip install -r tools/survey/requirements.txt
python tools/survey/survey_pipeline.py import-landxml survey.xml --output survey.json --glb-directory meshes
python tools/survey/survey_pipeline.py adjust adjustment.json --output adjustment-result.json
python tools/survey/survey_pipeline.py leveling leveling.json --output leveling-result.json
python tools/survey/survey_pipeline.py transform coordinates.json --output transformed.json
python tools/survey/survey_pipeline.py geodesic geodesic.json --output geodesic-result.json
python tools/survey/survey_pipeline.py cogo inverse.json --output inverse-result.json
python -m unittest discover -s tests/survey -v
```

Input contracts:

- `adjust`: `design` matrix, `observations` vector and full observation `covariance` matrix in consistent units. Covariance must be symmetric positive definite. Reports SVD solution, residuals, input-based parameter covariance, degrees of freedom, variance factor and condition number. No automatic outlier deletion or significance acceptance.
- `leveling`: `observations` arrays `[from, to, heightDifference, standardDeviation]`, plus `fixed` benchmark-height mapping. Correlated leveling can instead use the general adjustment interface. Disconnected/rank-deficient networks are rejected.
- `transform`: `points` as `[longitude/easting,latitude/northing]`, `sourceCRS`, `targetCRS`. Horizontal-only; network disabled; ballpark operations disallowed and best operation required. No fabricated Z conversion. Install required grids separately; archive grid checksums and licensing before geographic production use. Missing transformations do not remove the imported source data.
- `geodesic`: `a`, `b` as `[latitude,longitude]`, WGS84 ellipsoidal direct-distance reference via GeographicLib inverse.
- `cogo`: `a`, `b` as `[easting,northing]`. Returns planar distance and clockwise-from-north azimuth. Python API also exposes forward computation.

## LandXML scope and preservation

Recognizes matching namespaces/version 1.0, 1.1, 1.2 and 2.0; recognition does not establish full version/schema support. Reads CgPoints and explicit TIN points/faces. Supports meter, international foot and US survey foot. Converts LandXML N,E,Z text to explicit E,N,Z records while retaining identifiers. Excludes faces explicitly marked invisible from the render mesh. Rejects duplicate IDs, dangling references, nonfinite points and degenerate XY triangles. XML DTD/entity loading is prohibited and network access disabled. Intake limit: 64 MiB.

Retains original surface XML, including breaklines, and alignment, parcel, pipe-network, survey and coordinate-system collections for later interpretation. Curves, parcel boundary computation, textures, embedded objects, instrument reductions and digital signatures are **not** interpreted. Horizontal/vertical authority is UNVERIFIED; an imported CoordinateSystem string is not datum proof.

`--xsd path` validates against a self-contained operator-supplied local XSD and records its SHA-256. It never follows document schema URLs. No official XSD is bundled: downloading and establishing an authoritative, licensed schema snapshot remains a separate acquisition task. XSD success does not validate a signature or professional seal.

GLB export preserves existing TIN connectivity, uses metres and a local origin, maps E,N,Z to glTF X,-Z,Y convention as coordinates `(E,Z,-N)`, and records the source origin. It does not triangulate loose survey points, relocate a model into ECEF, certify heights or integrate a native .umap. JSON is the engineering-coordinate record; GLB is presentation only.

## External software boundaries

`execute_solver(executable, input_path, arguments, timeout)` runs an explicitly supplied local executable without a shell and records executable/input hashes, return code and logs. Use solver-specific native input and arguments; this adapter does not translate arbitrary LandXML into Gama XML/DynaML, parse adjustment results, or classify solver output as accepted. GNU Gama and DynAdjust binaries have not been built or bundled here.

Use the built-in adjustment as a transparent small-network/reference computation; cross-check real projects against independent solver fixtures, stochastic models and qualified review before adoption. A zero residual or passing test is not a certified measurement.

## Screenshot findings and researched sources (2026-11-07)

- http://www.landxml.org/ explicitly advertises LandXML-to-glTF conversion, Carlson's free viewer, proposed LandXML 2.0 changes and digital signing. Free viewer availability does not establish an open-source license.
- https://github.com/nathancrews/LandXML2glTF is the located C++ converter, with CMake Windows/Linux/macOS build instructions, GLTF SDK/TinyXML dependencies and Apache-2.0 licensing plus third-party terms. Optional upstream converter; not copied or built here. TSM's scoped GLB writer is implemented independently.
- https://proj.org/en/stable/ and https://pyproj4.github.io/pyproj/stable/: transformations; offline grid packaging required independently.
- https://geographiclib.sourceforge.io/: geodesics and geodetic reference calculations.
- https://www.gnu.org/software/gama/: independent survey adjustment candidate, with its own XML input.
- https://github.com/GeoscienceAustralia/DynAdjust: 3D network adjustment candidate; review dependency licensing and actual Windows builds independently.
- https://github.com/hujinghaoabcd/pySurveying: alpha Python adjustment and QC reference; not vendored.
- https://github.com/PaulSchrum/CogoPy and https://github.com/gameticharles/geocalc: alignment/field calculation references; not presumed numerically accepted or vendored.
- https://github.com/howtocivilengineer/Topo-Solver: separate offline browser TIN review reference; not a Python/native Unreal runtime.
- https://github.com/gbene/LandPy and https://github.com/mac999/landxml_parser: parser references; no inferred complete schema coverage.
- `SurvPy` public source/license and `LandXML-org/LandXML-Schema` remain unverified; do not create dependencies on guessed packages.

No signature/seal is generated, Windows shell extension installed, third-party viewer redistributed or regulatory decision automated.
