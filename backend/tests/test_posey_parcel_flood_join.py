"""Deterministic tests for the Posey parcel -> floodplain -> terrain chain.

No live network calls: HTTP is stubbed. The live chain was verified
against the real services on 2026-09-30; these tests pin the contract
(normalization, centroid math, fail-closed behavior, evidence schema).
"""

import json
import unittest
from unittest.mock import patch

from backend.geospatial.posey import parcel_flood_join as pfj


def _canned_parcel_response():
    return {
        "features": [
            {
                "attributes": {"StateCombi": "652708130051600018", "Parcel": "X"},
                "geometry": {
                    "rings": [
                        [[0.0, 0.0], [4.0, 0.0], [4.0, 2.0], [0.0, 2.0], [0.0, 0.0]]
                    ]
                },
            }
        ]
    }


class NormalizeTests(unittest.TestCase):
    def test_strips_formatting(self):
        self.assertEqual(
            pfj.normalize_state_combi("65-27-08-130-051.600-018"),
            "652708130051600018",
        )

    def test_passthrough_digits(self):
        self.assertEqual(pfj.normalize_state_combi("652708130051600018"), "652708130051600018")


class CentroidTests(unittest.TestCase):
    def test_area_weighted_centroid_of_rectangle(self):
        lon, lat = pfj.polygon_centroid([[[0.0, 0.0], [4.0, 0.0], [4.0, 2.0], [0.0, 2.0], [0.0, 0.0]]])
        self.assertAlmostEqual(lon, 2.0)
        self.assertAlmostEqual(lat, 1.0)


class FailClosedTests(unittest.TestCase):
    @patch.object(pfj, "_http_get_json", return_value=None)
    def test_parcel_unavailable_on_transport_failure(self, _mock):
        result = pfj.fetch_parcel_polygon("652708130051600018")
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertIn("reason", result)

    @patch.object(pfj, "_http_get_json", return_value={"features": []})
    def test_parcel_unavailable_when_no_feature(self, _mock):
        result = pfj.fetch_parcel_polygon("000000000000000000")
        self.assertEqual(result["status"], "UNAVAILABLE")

    @patch.object(pfj, "_http_get_json", return_value=None)
    def test_evidence_builder_never_promotes_unavailable(self, _mock):
        evidence = pfj.build_parcel_flood_evidence("65-27-08-130-051.600-018")
        self.assertEqual(evidence["parcel_polygon"]["status"], "UNAVAILABLE")
        for key in ("centroid", "dnr_flood_join", "nfhl_firm_panel", "terrain_3dep"):
            self.assertEqual(evidence[key]["status"], "UNAVAILABLE")
        # No regulatory conclusion fields may appear.
        blob = json.dumps(evidence).lower()
        self.assertNotIn("bfe_determination", blob)
        self.assertNotIn("insurance", blob.replace("flood-insurance", ""))
        self.assertNotIn("certified", blob)


class ParsingTests(unittest.TestCase):
    @patch.object(pfj, "_http_get_json", return_value=_canned_parcel_response())
    def test_parcel_parses_geometry_and_crs(self, _mock):
        result = pfj.fetch_parcel_polygon("652708130051600018")
        self.assertEqual(result["status"], "OBSERVED")
        self.assertEqual(result["crs"], "EPSG:4326")
        self.assertEqual(result["identifier_field"], "StateCombi")
        self.assertTrue(result["rings"])

    @patch.object(
        pfj,
        "_http_get_json",
        return_value={
            "features": [
                {"attributes": {"dfirm_id": "18129C", "fld_zone": "X", "sfha_tf": "F"}}
            ]
        },
    )
    def test_dnr_join_parses_attributes(self, _mock):
        result = pfj.dnr_flood_join(-87.89, 37.93)
        self.assertEqual(result["status"], "OBSERVED")
        self.assertEqual(result["dfirm_id"], "18129C")
        self.assertEqual(result["flood_zone"], "X")

    @patch.object(pfj, "_http_get_json", return_value=None)
    def test_nfhl_panel_never_fabricated(self, _mock):
        result = pfj.nfhl_firm_panel(-87.89, 37.93)
        self.assertEqual(result["status"], "UNAVAILABLE")
        blob = json.dumps(result)
        self.assertNotIn("18129C0300C", blob)

    @patch.object(
        pfj,
        "_http_get_json",
        return_value={"features": [
            {"attributes": {"DFIRM_ID": "18129C", "FIRM_ID": "18129C", "ST_FIPS": "18", "PCOMM": "129", "PANEL": "0265", "SUFFIX": "C", "FIRM_PAN": "18129C0265C", "PANEL_TYP": "REGULAR", "EFF_DATE": 1728000000000}},
            {"attributes": {"DFIRM_ID": "18129C", "FIRM_ID": "18129C", "ST_FIPS": "18", "PCOMM": "129", "PANEL": "0266", "SUFFIX": "C", "FIRM_PAN": "18129C0266C", "PANEL_TYP": "REGULAR", "EFF_DATE": 1728000000000}},
        ]},
    )
    def test_nfhl_panel_intersection_returns_all_panels(self, _mock):
        rings = [[[0.0, 0.0], [4.0, 0.0], [4.0, 2.0], [0.0, 2.0], [0.0, 0.0]]]
        result = pfj.nfhl_firm_panel(-87.89, 37.93, rings)
        self.assertEqual(result["status"], "OBSERVED")
        self.assertEqual(result["query_geometry"], "polygon")
        self.assertEqual(result["panel_count"], 2)
        self.assertEqual({panel["firm_panel"] for panel in result["panels"]}, {"18129C0265C", "18129C0266C"})
        self.assertEqual(result["panels"][0]["effective_date"], "2024-10-04")

    @patch.object(pfj, "_http_get_json", return_value={"features": []})
    def test_nfhl_zero_hit_is_observed_without_fabricating_panel(self, _mock):
        result = pfj.nfhl_firm_panel(-87.89, 37.93)
        self.assertEqual(result["status"], "OBSERVED")
        self.assertFalse(result["mapped"])
        self.assertEqual(result["panel_count"], 0)
        self.assertEqual(result["panels"], [])

    @patch.object(pfj, "_http_get_json", return_value={"error": {"code": 500}})
    def test_nfhl_arcgis_error_is_unavailable(self, _mock):
        result = pfj.nfhl_firm_panel(-87.89, 37.93)
        self.assertEqual(result["status"], "UNAVAILABLE")

    @patch.object(pfj, "_http_get_json", return_value={"unexpected": []})
    def test_nfhl_malformed_response_is_unavailable(self, _mock):
        result = pfj.nfhl_firm_panel(-87.89, 37.93)
        self.assertEqual(result["status"], "UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
