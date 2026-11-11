"""No-network proof that CityJSON staging cannot masquerade as renderable 3D Tiles."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from scripts.geospatial.cityjson_to_3d_tiles import (
    build_candidate_manifest,
    convert_cityjson_file,
)


def fixture(crs="EPSG:2966"):
    return {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": crs}},
        "features": [{
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [[
                [600000, 220000, 380], [600010, 220000, 380],
                [600010, 220010, 380], [600000, 220000, 380],
            ]]},
            "properties": {"id": "B-001", "lod": "2.2", "authorityClass": "DERIVED"},
        }],
    }


class CandidateTests(unittest.TestCase):
    def test_projected_coordinates_are_not_assumed_lon_lat(self):
        candidate = build_candidate_manifest(fixture())
        self.assertEqual(candidate["sourceCrs"], "EPSG:2966")
        self.assertEqual(candidate["rawInputBounds"][:2], [600000.0, 220000.0])
        self.assertEqual(candidate["lodCounts"], {"2.2": 1})
        self.assertFalse(candidate["renderable"])
        self.assertFalse(candidate["geodeticPlacementVerified"])
        self.assertFalse(candidate["verticalDatumVerified"])
        self.assertFalse(candidate["materialsVerified"])
        self.assertFalse(candidate["geometryExported"])
        self.assertIsNone(candidate["renderableContentUri"])
        self.assertNotIn("root", candidate)
        self.assertNotIn("asset", candidate)

    def test_source_hash_is_deterministic_and_bound_to_bytes(self):
        x = fixture()
        first = build_candidate_manifest(x)
        second = build_candidate_manifest(x)
        self.assertEqual(first["sourceGeojsonSha256"], second["sourceGeojsonSha256"])
        x["features"][0]["properties"]["id"] = "B-002"
        self.assertNotEqual(first["sourceGeojsonSha256"], build_candidate_manifest(x)["sourceGeojsonSha256"])

    def test_empty_input_does_not_invent_geographic_extent(self):
        x = {"type": "FeatureCollection", "features": []}
        result = build_candidate_manifest(x)
        self.assertIsNone(result["rawInputBounds"])
        self.assertEqual(result["sourceFeatureCount"], 0)

    def test_malformed_feature_collection_is_rejected(self):
        with self.assertRaises(ValueError):
            build_candidate_manifest({"type": "FeatureCollection", "features": "oops"})
        with self.assertRaises(ValueError):
            build_candidate_manifest({"type": "FeatureCollection", "features": [None]})
        with self.assertRaises(ValueError):
            build_candidate_manifest({"type": "SomethingElse", "features": []})

    def test_real_cityjson_fixture_stages_candidate_not_tileset(self):
        source = Path(__file__).resolve().parents[2] / "tests/fixtures/sample_building.city.json"
        self.assertTrue(source.is_file())
        with tempfile.TemporaryDirectory() as root:
            out = Path(root) / "stage"
            result = convert_cityjson_file(source, out)
            candidate = json.loads((out / "tileset-candidate.json").read_text("utf-8"))
            self.assertFalse(candidate["renderable"])
            self.assertFalse(result["renderable"])
            self.assertIsNone(result["tileset"])
            self.assertEqual(candidate["sourceCityjsonSha256"], hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertTrue((out / "space_graph.json").is_file())
            self.assertTrue((out / "buildings.geojson").is_file())
            self.assertFalse((out / "tileset.json").exists())
            # An old invalid tileset must never persist under the revised builder.
            (out / "tileset.json").write_text('{"root":{"content":{"uri":"buildings.geojson"}}}')
            with self.assertRaisesRegex(ValueError, "Existing tileset"):
                convert_cityjson_file(source, out)


if __name__ == "__main__":
    unittest.main()
