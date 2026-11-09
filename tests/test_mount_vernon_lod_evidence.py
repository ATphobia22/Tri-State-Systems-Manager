"""Real-input acceptance contracts; all example geometry is explicitly synthetic."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

FILE = Path(__file__).resolve().parents[1] / "scripts/geospatial/mount_vernon_lod_evidence.py"
SPEC = importlib.util.spec_from_file_location("mount_vernon_lod_evidence", FILE)
assert SPEC and SPEC.loader
lod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lod)
D = "a" * 64
SOURCE = {"url": "https://example.org/authoritative-plan", "sha256": D,
          "issuer": "TEST_ONLY_NOT_GOVERNMENT", "retrieved_at": "2026-10-01T10:00:00+00:00"}


def sample_plan():
    return {
        "schema": "tsm.indoor.topology.v1", "building_key": "IGIO:building:123",
        "source": dict(SOURCE), "crs": "EPSG:26916", "horizontal_units": "metres",
        "vertical_datum": "UNVERIFIED",
        "floors": [{"id": "L1", "elevation_m_navd88": None}],
        "nodes": [
            {"id": "R1", "floor_id": "L1", "kind": "ROOM", "xy_m": [510000, 4190000], "source_sha256": D},
            {"id": "D1", "floor_id": "L1", "kind": "DOOR", "xy_m": [510001, 4190001], "source_sha256": D},
            {"id": "E1", "floor_id": "L1", "kind": "EXTERIOR_EXIT", "xy_m": [510002, 4190001], "source_sha256": D},
        ],
        "links": [
            {"from": "R1", "to": "D1", "kind": "DOORWAY", "source_sha256": D},
            {"from": "D1", "to": "E1", "kind": "CORRIDOR", "source_sha256": D},
        ],
    }


class IndoorContract(unittest.TestCase):
    def test_connected_reference_graph_is_not_egress_guidance(self):
        r = lod.assess_indoor_topology(sample_plan())
        self.assertEqual(r["node_count"], 3)
        self.assertEqual(r["connected_components"], [["D1", "E1", "R1"]])
        self.assertEqual(r["exterior_exit_node_count"], 1)
        self.assertEqual(r["floors_with_stated_elevations"], 0)
        self.assertFalse(r["routing_instructions_authorized"])
        self.assertFalse(r["source_document_bytes_independently_verified"])

    def test_disconnected_graph_reported_not_silently_connected(self):
        plan = sample_plan()
        plan["links"] = plan["links"][:1]
        result = lod.assess_indoor_topology(plan)
        self.assertEqual(len(result["connected_components"]), 2)

    def test_missing_plan_source_or_false_floor_height_rejected(self):
        plan = sample_plan()
        del plan["source"]
        with self.assertRaisesRegex(lod.EvidenceError, "SOURCE_RECORD"):
            lod.assess_indoor_topology(plan)
        plan = sample_plan()
        plan["floors"][0]["elevation_m_navd88"] = 120.0
        with self.assertRaisesRegex(lod.EvidenceError, "DATUM"):
            lod.assess_indoor_topology(plan)
        plan = sample_plan()
        plan["vertical_datum"] = "NAVD88"
        plan["floors"][0]["elevation_m_navd88"] = 120.0
        with self.assertRaisesRegex(lod.EvidenceError, "INVALID_SHA256"):
            lod.assess_indoor_topology(plan)

    def test_datum_units_edges_and_nonfinite_coords_rejected(self):
        for field, value in [("crs", "EPSG:2966"), ("horizontal_units", "ftUS")]:
            plan = sample_plan()
            plan[field] = value
            with self.assertRaises(lod.EvidenceError):
                lod.assess_indoor_topology(plan)
        plan = sample_plan()
        plan["nodes"][0]["xy_m"] = [float("nan"), 2]
        with self.assertRaisesRegex(lod.EvidenceError, "COORDINATES"):
            lod.assess_indoor_topology(plan)
        plan = sample_plan()
        plan["links"].append(dict(plan["links"][0]))
        with self.assertRaisesRegex(lod.EvidenceError, "DUPLICATE"):
            lod.assess_indoor_topology(plan)

    def test_untrusted_source_http_rejected(self):
        plan = sample_plan()
        plan["source"]["url"] = "http://example.org/plan"
        with self.assertRaisesRegex(lod.EvidenceError, "HTTPS"):
            lod.assess_indoor_topology(plan)


class RoofObjContract(unittest.TestCase):
    def test_source_and_batch_digest_enforced(self):
        with tempfile.TemporaryDirectory() as root:
            p = Path(root) / "source.json"
            p.write_text('{"type":"FeatureCollection","features":[]}')
            with self.assertRaisesRegex(lod.EvidenceError, "SHA256_MISMATCH"):
                lod.load_json(p, D)

    def test_roof_export_strips_floors_and_walls_and_retains_identity(self):
        try:
            import trimesh
            import numpy as np
        except ImportError:
            self.skipTest("trimesh and numpy absent: CI installs pinned dependencies")
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature", "geometry": {"type": "Polygon",
                      "coordinates": [[[-87.9, 37.9], [-87.899, 37.9],
                                       [-87.899, 37.901], [-87.9, 37.9]]]},
                    "properties": {"objectid": 77, "roofPlanes": [
                        {"normal": [0.0, 0.0, 1.0], "d": -130.0,
                         "rmse_m": 0.08, "inlier_count": 50}]},
                }],
            }
            source_path = base / "source.geojson"
            source_path.write_text(json.dumps(source))
            glb_dir = base / "glb"
            glb_dir.mkdir()
            box = trimesh.creation.box(extents=(4.0, 3.0, 6.0))
            box.apply_translation((0.0, 0.0, 127.0))
            box.export(glb_dir / "lod2-77.glb")
            summary = {
                "generated_by": "lod2-batch-reconstruct.py", "roof_planes_crs": "EPSG:3857",
                "results": [{"objectid": 77, "status": "ok", "watertight": True,
                             "glb": "/old-machine/lod2-77.glb", "origin_3857": [-9780000.0, 4600000.0]}],
            }
            summary_path = base / "batch.json"
            summary_path.write_text(json.dumps(summary))
            result = lod.export_roof_obj(
                source_geojson=source_path, source_sha256=lod.sha256(source_path.read_bytes()),
                batch_summary=summary_path, batch_sha256=lod.sha256(summary_path.read_bytes()),
                glb_root=glb_dir, objectid=77, outdir=base / "output",
            )
            self.assertEqual(result["building_key"], "IGIO:building:77")
            self.assertEqual(result["triangles_roof"], 2)
            self.assertEqual(result["geometric_lod"], "LOD2_ROOF_ONLY_DERIVED_CANDIDATE")
            self.assertFalse(result["citygml_3_lod3_certified"])
            self.assertFalse(result["engineering_approved"])
            self.assertEqual(lod.sha256((base / "output" / "roof-77.obj").read_bytes()), result["obj_sha256"])
            self.assertEqual((base / "output" / "roof-77.manifest.json").is_file(), True)

    def test_unusable_plane_never_promoted(self):
        data = {"type": "FeatureCollection", "features": [{
            "type": "Feature", "geometry": {"type": "Polygon", "coordinates": []},
            "properties": {"objectid": 77, "roofPlanes": [
                {"normal": [0, 0, 1], "d": -100, "rmse_m": 0.1, "inlier_count": 3},
            ]},
        }]}
        with self.assertRaisesRegex(lod.EvidenceError, "ROOF_PLANE_GATE_FAILED"):
            lod.find_building(data, 77)


if __name__ == "__main__":
    unittest.main()
