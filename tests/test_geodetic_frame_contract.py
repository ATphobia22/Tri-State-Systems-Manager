"""Regression tests for the project's canonical horizontal CRS contract."""

import pytest
from pydantic import ValidationError

from backend.api.v1.schemas import GeodeticFrame, HORIZONTAL_CRS


def test_geodetic_frame_accepts_canonical_horizontal_crs() -> None:
    frame = GeodeticFrame(horizontal_crs=HORIZONTAL_CRS, vertical_datum="NAVD88")
    assert frame.horizontal_crs == "EPSG:2966"


@pytest.mark.parametrize("horizontal_crs", ["EPSG:2967", "EPSG:4326", "WGS84", ""])
def test_geodetic_frame_rejects_noncanonical_horizontal_crs(
    horizontal_crs: str,
) -> None:
    with pytest.raises(ValidationError, match="canonical project CRS EPSG:2966"):
        GeodeticFrame(horizontal_crs=horizontal_crs, vertical_datum="NAVD88")
