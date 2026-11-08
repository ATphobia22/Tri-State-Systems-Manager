"""Loader for the vendored pySurveying snapshot, with clean degradation.

If the vendored tree is missing (for example a partial checkout), the
wrappers in this package raise a clear ``RuntimeError`` naming the
missing snapshot instead of failing with a bare ``ImportError`` — and
the stdlib-only modules (``landxml_import``, ``total_station``) keep
working, because they never import pySurveying at all.
"""

from __future__ import annotations

import types

PYSURVEYING_REPO = "https://github.com/hujinghaoabcd/pySurveying"
PYSURVEYING_COMMIT = "e2f129080b7bc1aed1857ed94c88dee22d90c291"
PYSURVEYING_VERSION = "0.3.0"


def load_pysurveying() -> types.ModuleType:
    """Return the vendored ``pysurveying`` package, or raise RuntimeError."""
    try:
        from backend.thirdparty import pysurveying

        return pysurveying
    except ImportError:
        pass
    try:
        # Running with backend/ itself on sys.path (see backend/tests).
        from thirdparty import pysurveying  # type: ignore[no-redef]

        return pysurveying
    except ImportError:
        pass
    raise RuntimeError(
        "vendored pySurveying is unavailable: expected "
        "backend/thirdparty/pysurveying/ at commit "
        f"{PYSURVEYING_COMMIT} (source: {PYSURVEYING_REPO}). "
        "Do not substitute another library silently — re-vendor the "
        "pinned snapshot. The stdlib LandXML and GSI readers in this "
        "package still work without it."
    )


def pysurveying_available() -> bool:
    """True when the vendored pySurveying snapshot imports cleanly."""
    try:
        load_pysurveying()
    except RuntimeError:
        return False
    return True
