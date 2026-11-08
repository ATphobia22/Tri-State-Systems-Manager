# Survey Computation Notes — scope, evidence rules, and provenance

> **Status: advisory computation only. Nothing in `backend/survey/` is a
> survey certification, nothing is survey-grade by itself, and nothing
> is FEMA-submittable.** Adjusted coordinates enter a FEMA/LOMA evidence
> package only with a licensed surveyor's sign-off and the existing
> human gate. Every result from this package is stamped
> `provisional: True` for exactly that reason.

## What was built (2026-11-07, on main)

| Piece | File | Provenance |
|---|---|---|
| COGO wrappers (inverse/forward, Bowditch traverses, intersections, resection, polar stakeout) | `backend/survey/cogo.py` | Vendored pySurveying 0.3.0 |
| Weighted least squares + 2D control-network adjustment with QC | `backend/survey/adjustment.py` | Vendored pySurveying 0.3.0 |
| Read-only LandXML 1.2 import (Surfaces TIN, Parcels, CgPoints, CoordinateSystem) | `backend/survey/landxml_import.py` | Hand-written, stdlib only |
| Read-only Leica GSI reader | `backend/survey/total_station.py` | Hand-written, stdlib only |
| Vendored pySurveying snapshot | `backend/thirdparty/pysurveying/` | MIT, commit `e2f1290` |
| GNU Gama cross-check script | `scripts/survey/gama_crosscheck.sh` | External CLI only |
| Console display checks (inverse / traverse, provisional) | `tsm-console/src/lib/geodetic/cogo-display.ts` | Hand-written, no new dep |
| Tests (textbook regressions + synthetic fixtures) | `backend/tests/test_survey_*.py`, `tsm-console/src/lib/geodetic/cogo-display.test.ts` | See below |

## Reference values

- Working frame: **EPSG:2966** (Indiana State Plane West, US ft) + **NAVD88**.
- Reference flood elevation: **BFE 369.1 ft NAVD88** (FEMA FIS
  18129CV000A Table 9). The superseded 375.0 ft working figure must
  never be reintroduced.
- Coordinate convention everywhere: planar **x = easting, y = northing**.
  LandXML stores points as **northing, easting, [elevation]** — the
  reader swaps to (x, y) and records the source order, so a swap is
  visible, not silent.

## Verification behind the library choices (2026-11-07)

Each candidate was checked live on GitHub / the web before use:

- **hujinghaoabcd/pySurveying** — MIT, created 2026-08-08, Alpha,
  no PyPI release yet (0.3.0). COGO + weighted least squares + QC +
  LandXML points + Leica GSI, pyproj-based, 52 tests. Vendored as a
  pinned snapshot (`e2f129080b7bc1aed1857ed94c88dee22d90c291`,
  verified to exist and to equal the repo HEAD at vendoring time)
  with its MIT license and `VENDORED.md`. Switch to a PyPI dependency
  if/when 0.3.0 is released. Its own caveat is carried verbatim: its
  QC routines are "not a substitute for the significance-level design
  required by a specific surveying specification."
- **OSGeo/PROJ (9.9.0, MIT) and pyproj4/pyproj (3.8.0, MIT)** —
  verified, already in TSM. No action taken.
- **GNU Gama (v2.29, 2024, GPLv3, GNU Savannah)** — real, but no
  native Leica/Trimble format support was found in the 2.29 manual,
  and global adjustment is only partial. Used as an **external**
  cross-check CLI only, never vendored or linked (GPLv3 is
  incompatible with incorporating code into an Apache-2.0 codebase).
- **geographiclib** — real, but the `geographiclib/geographiclib`
  repo is C++-only since v2.0 and duplicates `pyproj.Geod`. Not added.

## Deliberately NOT used — and why

- **PaulSchrum/CogoPy** — alignment chains only, dormant since 2016,
  LGPL-3.0, ArcGIS-dependent. Not used.
- **gameticharles/geocalc** — MIT but dormant since 2023, 3 commits,
  no traverse adjustment. Not used.
- **SurvPy** — does **not** exist as open source. The only SurvPy
  found is a closed-source internal library of NSW DCS Spatial
  Services (Australia). Dropped from all lists.
- **LandXML-org/LandXML-Schema** — 404 on GitHub. The official
  schema is at **landxml.org** (LandXML 1.2, 2008, namespace
  `http://www.landxml.org/schema/LandXML-1.2`, XSD at
  `.../schema/LandXML-1.2/LandXML-1.2.xsd`). The reader was validated
  against that real XSD (see tests).
- **howtocivilengineer/Topo-Solver** — a browser TIN builder, not
  Python/COGO, and **no license** ("License to be confirmed"). No
  reuse; reference only.
- **npm `landxml`, iskandern/KoTIN, mac999/landxml_parser** — each
  covers only part of LandXML (TIN-only, alignments-only, or an
  unverified 2-week-old viewer). Not vendored or depended on.
- **Total Open Station** (GPLv3) — used only as a *behavioral
  reference* for the GSI word table (its public docs); no code copied.

## LandXML reader: what it does and does not do

- Reads: `Surfaces`/`Surface`/`Definition` (`surfType`, `Pnts`/`P`,
  `Faces`/`F`), `Parcels`/`Parcel`/`CoordGeom` (`Line` segments;
  `Curve`/`Spiral` are reported, not evaluated), `CgPoints`/`CgPoint`,
  `CoordinateSystem` (direct child of root; EPSG from the `epsgCode`
  attribute, falling back to an explicit `EPSG:NNNN` in name/desc —
  never guessed from prose), `Units` (Metric/Imperial).
- Does **not** read Alignments, PipeNetworks, PlanFeatures, Survey,
  or any other section — those are reported in `warnings`, not
  silently ignored.
- There is **no LandXML writer**. Export is out of scope.
- `tin_to_geojson` emits planar [easting, northing] vertices by
  default and says so in `crs_note`. Reprojection to WGS84 requires
  both `to_crs` and an explicitly stated `source_epsg`.

## GSI reader: what it does and does not do

- Low-level word records (WI, info chars, raw signed int) plus block
  grouping on WI 11 and point extraction for WI 81/82/83.
- Word indexes are **two digits** (Leica WI codes are two digits).
  This deliberately differs from pySurveying's `\d{2,3}` pattern,
  which misreads real GSI-8 tokens such as `110001+00001001` as word
  110 instead of WI 11 / block 0001 / point 1001. Covered by test.
- Values are converted only with caller-supplied settings
  (`coordinate_decimals`, angle `unit`): GSI stores integers with
  implied decimals that depend on instrument configuration. The raw
  integer is always kept. No instrument driver, no live connection.

## Tests and regression sources

- **Textbook**: Song Lijie, 《测量平差程序设计》 §§3.1.5/3.2.5 —
  weighted and correlated least squares, expected `X = [2, 1, -4]`,
  `sigma0 = 6`, published Qxx. Reproduced exactly.
- **Upstream**: pySurveying's own closed-square traverse, angle
  adjustment, and distance-network cases.
- **Fixtures are synthetic**: the LandXML fixture is a 100×100
  synthetic grid; the GSI fixture follows Leica documentation
  examples; the "Posey-style" traverse uses rounded whole-foot
  State Plane coordinates and is labelled synthetic. No fixture
  claims a real survey point.
- **XSD validation**: the LandXML fixture is validated against the
  real LandXML 1.2 XSD fetched from landxml.org (test skips when
  the XSD file is absent from the checkout machine).
- **Gama cross-check**: `scripts/survey/gama_crosscheck.sh` converts
  a TSM network JSON (distance/direction observations only) to
  minimal GAMA XML, runs `gama-local`, and diffs adjusted
  coordinates. Gama is not installed on the build VM, so the script
  reports that instead of running — install per its message.

## What was deliberately NOT built

Certified survey adjustment; 3D network adjustment; GNSS PPP/RTK;
total-station drivers or live instrument connections; LandXML export
or Civil 3D round-trip; road-alignment design; deformation
monitoring; any claim that adjusted coordinates are survey-grade or
FEMA-submittable; auto-ingest of LandXML into evidence packages.

## License compatibility (TSM charter: Apache-2.0)

MIT (pySurveying, PROJ, pyproj) is compatible with attribution —
preserved in `backend/thirdparty/pysurveying/VENDORED.md` and here.
LGPL-3.0 (CogoPy) and GPLv3 (Gama, Total Open Station) code was not
copied in; Gama is invoked only as an external process.
Topo-Solver has no license — nothing was reused from it.
The LandXML 1.2 XSD states no license; the standard is referenced,
not relicensed, and the reader is original code.
