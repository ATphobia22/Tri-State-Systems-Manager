import unittest
from tools.geospatial_exchange.posey_subsurface_context import contexts


def parcel(key, west):
    return {"properties": {"objectid": key, "state_parcel_id": "same", "county_fips": "18129"},
            "geometry": {"type": "Polygon", "coordinates": [[[west, 37], [west+1, 37],
                          [west+1, 38], [west, 38], [west, 37]]]}}


def well(key, lon, quality):
    return {"properties": {"objectid": key, "strcounty": "POSEY", "location_quality": quality},
            "geometry": {"type": "Point", "coordinates": [lon, 37.5]}}


class ContextTests(unittest.TestCase):
    def test_precise_only_and_distinguish_missing_source_from_non_overlap(self):
        left, right = parcel(1, -88), parcel(2, -87)
        soil = {**left, "properties": {"mukey": "100"}}
        result = contexts([left, right], [well(1, -87.5, "field-located"), well(2, -87.5, "geocoded"),
                         well(3, -87, "field-located")], [("soil", [soil], "mukey"), ("controls", None, "objectid")])
        left, right = result["parcels"]
        self.assertEqual(result["wellCounts"]["BOUNDARY_OR_OVERLAP"], 1)
        self.assertEqual(result["wellCounts"]["APPROXIMATE_OR_UNKNOWN_NOT_ASSIGNED"], 1)
        self.assertEqual(left["sourceWellReferences"][0]["sourceObjectId"], 1)
        self.assertEqual(left["soil"]["sourceIds"], ["100"])
        self.assertEqual(right["soil"]["status"], "NO_OVERLAP_IN_SUPPLIED_SNAPSHOT")
        self.assertEqual(right["controls"]["status"], "SOURCE_UNAVAILABLE")
