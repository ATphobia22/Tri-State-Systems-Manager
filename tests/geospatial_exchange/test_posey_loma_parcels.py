import unittest
from pathlib import Path
from unittest.mock import patch

from shapely.geometry import box, mapping

from tools.geospatial_exchange.posey_loma_parcels import parcel_queue


class PoseyLomaParcelQueueTests(unittest.TestCase):
    def test_preserves_repeated_ids_and_excludes_touching_or_invalid_geometry(self):
        def parcel(geometry):
            return {"geometry": geometry, "properties": {"state_parcel_id": "001"}}

        parcels = [
            parcel(mapping(box(0, 0, 2, 2))),
            parcel(mapping(box(2, 0, 3, 2))),
            parcel(None),
        ]
        hazards = [{
            "geometry": mapping(box(0, 0, 2, 2)),
            "properties": {"dfirm_id": "18129C", "sfha": "T"},
        }]
        with patch(
            "tools.geospatial_exchange.posey_loma_parcels.load",
            side_effect=[(parcels, "parcel-hash"), (hazards, "hazard-hash")],
        ):
            receipt, rows = parcel_queue(Path("."))

        self.assertEqual([row[:4] for row in rows], [
            (1, "001", "UNASSIGNED", 3),
            (2, "001", "UNASSIGNED", 3),
            (3, "001", "UNASSIGNED", 3),
        ])
        self.assertEqual([row[4] for row in rows], [
            "BAFL_AREA_OVERLAP",
            "NO_AREA_OVERLAP_IN_USABLE_BAFL",
            "UNUSABLE_PARCEL_GEOMETRY",
        ])
        self.assertTrue(all(row[5] == "INSUFFICIENT_EVIDENCE" for row in rows))
        self.assertEqual(receipt["repeated_nonblank_state_parcel_ids"], 1)
        self.assertEqual(receipt["eligibility_verified_records"], 0)
