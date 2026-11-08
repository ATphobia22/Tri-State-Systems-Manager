"""TSM survey computation package — advisory COGO / least-squares / LandXML.

Scope
-----
Thin, explicitly-provisional wrappers over the vendored pySurveying
snapshot (``backend/thirdparty/pysurveying/``, MIT, pinned commit
``e2f129080b7bc1aed1857ed94c88dee22d90c291``) plus hand-written stdlib
readers for LandXML 1.2 and Leica GSI. No new surveying mathematics is
invented here: every computation delegates to the vendored library, and
every result is labelled provisional.

Status — read before using any output
-------------------------------------
* PROVISIONAL / ADVISORY ONLY. This package is not a survey
  certification, not survey-grade by itself, and not FEMA-submittable.
* Adjusted coordinates must NEVER enter a FEMA/LOMA evidence package
  without a licensed surveyor's sign-off and the existing human gate.
* Coordinate convention throughout: planar X = easting, Y = northing.
  TSM's working frame is EPSG:2966 (Indiana State Plane West, US ft)
  + NAVD88; callers must state the frame/units of their inputs, and
  every result records them. The vendored library is unit-agnostic —
  it cannot know what frame your numbers are in.
* Reference elevation for flood work: BFE 369.1 ft NAVD88
  (FEMA FIS 18129CV000A Table 9). Never the superseded 375.0 ft figure.

Modules
-------
``cogo``            inverse/forward, traverses (Bowditch), intersections,
                    resection, polar stakeout.
``adjustment``      weighted least squares + 2D control-network
                    adjustment with QC (residuals, redundancy, data
                    snooping, error ellipses).
``landxml_import``  read-only, stdlib-only LandXML 1.2 import (Surfaces
                    TIN, Parcels, CgPoints, CoordinateSystem). No writer.
``total_station``   read-only Leica GSI word reader (low-level records
                    plus documented WI table). No instrument driver.

See ``docs/survey/SURVEY-COMPUTATION-NOTES.md`` for the full scope,
evidence rules, and what was deliberately NOT built.
"""

from __future__ import annotations

#: Marker stamped on every computation result from this package.
PROVISIONAL = True

#: Short advisory notice; wrapper results carry this verbatim.
SURVEY_ADVISORY_NOTICE = (
    "PROVISIONAL — advisory survey computation only. Not a survey "
    "certification, not survey-grade by itself, and not FEMA-submittable. "
    "Adjusted coordinates require a licensed surveyor's sign-off and the "
    "human gate before entering any FEMA/LOMA evidence package."
)

#: Reference flood elevation used by TSM flood work (ft NAVD88).
BFE_FT_NAVD88 = 369.1

#: Working horizontal frame for TSM survey inputs unless stated otherwise.
WORKING_EPSG = 2966

__all__ = [
    "BFE_FT_NAVD88",
    "PROVISIONAL",
    "SURVEY_ADVISORY_NOTICE",
    "WORKING_EPSG",
]
