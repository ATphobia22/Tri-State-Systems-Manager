# Vector Layer Notes — GeoPandas for TSM

> **Status: advisory computation only. Nothing in
> `backend/geospatial/vector_io.py` is survey-grade by itself, and
> nothing is FEMA-submittable.** Vector outputs enter a FEMA/LOMA
> evidence package only with a licensed surveyor's sign-off and the
> existing human gate. Every result is stamped `provisional: True`
> for exactly that reason. See also
> `docs/survey/SURVEY-COMPUTATION-NOTES.md` for the survey package's
> identical evidence rules.

## What was built (2026-11-07, on main)

| Piece | File | Provenance |
|---|---|---|
| GeoPandas vector I/O wrapper (read GeoJSON/SHP/GPKG → EPSG:2966, validate, write GeoJSON, parcel-vs-flood join) | `backend/geospatial/vector_io.py` | GeoPandas 1.2.0 (BSD-3-Clause) |
| Dependency declaration | `backend/requirements.txt` (`geopandas>=1.2,<2`) | PyPI, released 2026-09-28 |
| Tests (synthetic parcels + flood extent, Posey-shaped fixture) | `backend/tests/test_vector_io.py`, `backend/tests/fixtures/vector/*.geojson` | Synthetic fixtures only |
| This note | `docs/geospatial/VECTOR-NOTES.md` | — |

## Why GeoPandas, and what it is for

TSM had no standard Python vector layer: zero `geopandas` or `fiona`
hits anywhere in the repo before this change. Raster work already had
`rasterio`, and one script
(`scripts/geo/validate-eight-county-exact-spatial-objects.py`) already
assumed Shapely 2.x without declaring it. GeoPandas fills that gap —
parcels, boundaries, flood extents, GeoJSON/SHP/GPKG I/O, spatial
joins, CRS handling on top of the pyproj already in use — and
formalises the Shapely dependency at the same time.

## Reference values

- Working frame: **EPSG:2966** (Indiana State Plane West, US ft) +
  **NAVD88**. Sources with no CRS are an error, never silently
  assumed. Areas from the join are square feet (EPSG:2966 is in
  US survey feet).
- Reference flood elevation: **BFE 369.1 ft NAVD88** (FEMA FIS
  18129CV000A Table 9). The superseded 375.0 ft working figure must
  never be reintroduced.
- No network access at runtime: `read_vector` reads local files only.
  Provenance (source, SHA-256, source CRS, vintage, read time) is
  recorded on `gdf.attrs["tsm_provenance"]`; plain GeoJSON cannot
  carry it, so `write_geojson` returns the provenance as a dict that
  must be kept with the file.
- Parcel owner identity is never read, joined, or written here.

## Verified versions (2026-11-07)

Checked live on PyPI / GitHub before use. GeoPandas **1.2.0**
(released 2026-09-28, BSD-3-Clause) is the current stable release;
it requires Python >=3.11, NumPy >=2.0, pandas >=2.2, Shapely
>=2.1, pyproj >=3.7, pyogrio >=0.8. Test-env resolution in a clean
venv on 2026-11-07: geopandas 1.2.0, shapely 2.2.0, pyogrio 0.13.0,
pyproj 3.8.0, numpy 2.5.4. That clean venv also resolved pandas
3.1.1, but TSM's `pandas>=2.1,<3` range keeps real installs on
pandas 2.2–2.9, which GeoPandas 1.2 supports. pyarrow is optional
(GeoParquet only) and was not installed in the test env.

## Deliberately NOT built / NOT adopted (2026-11-07 verification)

Each candidate below was checked live on GitHub / the web before
this decision, so this list should not be re-proposed without new
evidence:

- **pyg-team/pytorch_geometric (2.8.0, MIT)** — real Graph Neural
  Network library, not a survey/geospatial library. Research-only
  and out of scope: TSM has no ML model, training data, labels, or
  validated use case, and it would drag in PyTorch + CUDA wheels.
  A graph model of the river/levee network is speculative and needs
  its own research decision first.
- **geoserver/geoserver (3.0.2, GPLv2, Java)** — real OGC
  WMS/WFS/WCS server, but a separate Java deployment (Tomcat/Jetty)
  is incompatible with TSM's static GitHub Pages deploy, offline
  Windows runtime, and no-AWS / zero-lock-in direction. OGC
  WMS/WFS remains at most an external interop option.
- **geotools/geotools (35.2, LGPL, Java)** — real OGC-spec Java
  toolkit, but TSM is a Python/Node stack with no Java anywhere.
  Reference only for OGC-spec behaviour.
- **johan/world.geo.json** — data repo, not code: low-res country
  GeoJSON, **no license**, dormant since 2016, and its own README
  calls it "to mock something fast and loose" and flags its legal
  status as dubious. Do NOT use. Authoritative boundaries stay
  Census TIGER / IndianaMap.
- **mac999/landxml_parser (MIT)** — alignments, cross-sections and
  profiles only; **no TIN surfaces** in its README (TIN is planned
  future work; the surfaces parser is the npm `landxml` package,
  not mac999). Its only uncovered piece vs TSM is alignment/profile
  import, Korea-centric (GSR80 transforms). TSM already has LandXML
  import in `backend/survey/landxml_import.py`; if alignment import
  is ever needed, hand-roll it from the LandXML 1.2 spec the same
  way. Do not adopt.

## Already covered — no action

- **OSGeo/PROJ (9.9.0, MIT) / pyproj4/pyproj (3.8.0, MIT)** — already
  in TSM; GeoPandas builds on pyproj for CRS work.
- **COGO / least-squares / LandXML** — already built in
  `backend/survey/` (commit `cc15ebec`, 2026-11-07).
- **geographiclib** — C++-only since v2.0; duplicate of
  `pyproj.Geod`. Do not add.
- **PaulSchrum/CogoPy, gameticharles/geocalc** — dormant, do not use.
