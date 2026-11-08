"""Vendored copy of pySurveying (MIT) — pinned snapshot, unmodified code.

Source: https://github.com/hujinghaoabcd/pySurveying
Pinned commit: e2f129080b7bc1aed1857ed94c88dee22d90c291
  ("Remove temporary documentation diagnostic workflow", verified 2026-11-07
  via GitHub commit page and `git ls-remote`; HEAD of the repository at
  vendoring time, so the pinned commit IS the repository HEAD.)
Vendored: 2026-11-07, into the Tri-State Systems Manager repo.
Upstream version at this commit: 0.3.0 (Alpha, no PyPI release yet).

License: MIT — Copyright (c) 2026 Jinghao Hu. Full text in LICENSE-MIT
in this directory. MIT is compatible with TSM's Apache-2.0 charter;
attribution is preserved here and in docs/survey/SURVEY-COMPUTATION-NOTES.md.

What was vendored
-----------------
The complete ``src/pysurveying`` package tree, byte-for-byte, plus the
upstream LICENSE (as LICENSE-MIT). No file was edited. Verified with
``diff -r`` against a fresh clone at the pinned commit: identical except
for the added LICENSE-MIT and this file.

What TSM uses from it
---------------------
Only the computation core, through thin wrappers in ``backend/survey/``:
``basic`` (inverse/forward/intersections/resection), ``traverse``
(Bowditch), ``adjustment`` (weighted least squares, 2D control networks),
``quality`` (standardized residuals, data snooping, error ellipses),
``engineering`` (polar stakeout) and ``models`` (Point/Observation).
``transform`` (pyproj-based) is available but TSM keeps its own
EPSG:2966 chain in ``tsm-console/src/lib/geodetic/`` and
``backend/engineering/hecras_geometry.py``.

What TSM does NOT use from it
-----------------------------
``ui.py`` / ``webapp.py`` (Streamlit UI — not imported anywhere in TSM;
they would need the optional streamlit/matplotlib dependencies).
``io.read_points`` / ``read_gsi`` / ``read_landxml_points`` are NOT used:
TSM's LandXML import (``backend/survey/landxml_import.py``) and Leica GSI
reader (``backend/survey/total_station.py``) are hand-written stdlib
implementations, so the vendored I/O helpers are reference only.

Why vendored instead of a dependency
------------------------------------
pySurveying has no PyPI release yet (Alpha, 0.3.0). Vendoring a pinned
snapshot keeps the build reproducible and offline-capable. Switch to a
PyPI dependency (``pysurveying>=0.3``) if/when a release is published,
and delete this directory at that point.

Upstream caveat, carried verbatim
---------------------------------
pySurveying's own documentation states its quality-control routines are
"computational tools, not a substitute for the significance-level design
required by a specific surveying specification." TSM treats every output
as PROVISIONAL/advisory — see ``backend/survey/__init__.py`` and
``docs/survey/SURVEY-COMPUTATION-NOTES.md``. Nothing here is a survey
certification and nothing here enters a FEMA/LOMA evidence package
without a licensed surveyor's sign-off and the existing human gate.
"""
