"""Source→IFC→GLB→BIM metadata package regression tests (synthetic only)."""
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest

from scripts.geospatial import build_ifc_review_package as pipeline

GUID_A = "0" * 22
GUID_B = "1" * 22

def sha(data):
    return hashlib.sha256(data).hexdigest()

def fake_glb(nodes):
    obj = {"asset": {"version": "2.0"}, "meshes": [
        {"primitives": [{"attributes": {"POSITION": 0}}]},
        {"primitives": [{"attributes": {"POSITION": 0}}]},
    ], "nodes": nodes}
    payload = json.dumps(obj).encode()
    payload += b" " * ((4 - len(payload) % 4) % 4)
    return struct.pack("<4sIIII", b"glTF", 2, 20 + len(payload),
                       len(payload), 0x4E4F534A) + payload

class ReviewPipelineTests(unittest.TestCase):
    def setUp(self):
        t = tempfile.TemporaryDirectory()
        self.addCleanup(t.cleanup)
        self.root = Path(t.name)
        self.ifc = self.root / "source.ifc"
        self.ifc.write_bytes(b"ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n")
        self.d = sha(self.ifc.read_bytes())
        self.intake = self.root / "metadata.json"
        self.intake.write_text(json.dumps({
            "sourceId": "sample-ifc", "expectedSha256": self.d,
            "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88",
            "units": "m", "license": "synthetic-test",
            "authorityClass": "DERIVED"
        }))
        self.preflight = self.root / "preflight.json"
        self.preflight.write_text(json.dumps({
            "schema": "tsm.geobim.ifc-preflight.v1", "source": {"sha256": self.d},
            "products": [
                {"globalId": GUID_A, "ifcClass": "IfcWall", "hasRepresentation": True},
                {"globalId": GUID_B, "ifcClass": "IfcSlab", "hasRepresentation": True},
            ],
            "georeferencing": {
                "projectedCrs": "EPSG:2966", "verticalDatumDeclared": "NAVD88",
                "lengthUnits": {"verified": True, "metersPerModelUnit": 1.0},
                "mapConversion": {
                    "eastings": 1250000.0, "northings": 750000.0,
                    "orthogonalHeight": 380.0, "scale": 3937/1200,
                    "axisAbscissa": 1.0, "axisOrdinate": 0.0,
                }
            }, "geometry": {"meshesExported": 0}
        }))
        self.glb = self.root / "ifc-model.glb"
        self.glb.write_bytes(fake_glb([
            {"mesh": 0, "name": GUID_A},
            {"mesh": 1, "extras": {"ifcGlobalId": GUID_B}},
        ]))
        self.bridge = self.root / "bridge.json"
        self.bridge_data = {
            "schemaVersion": "tsm.geobim.mesh-bridge.v1",
            "sourceIfcSha256": self.d,
            "preflightSha256": sha(self.preflight.read_bytes()),
            "geometry": {"file": self.glb.name, "sha256": sha(self.glb.read_bytes()),
                         "coordinateFrame": "IFC_MODEL_LOCAL"},
            "links": [{"ifcGlobalId": GUID_A, "assetId": "IGIO:fixture-A",
                       "linkState": "HUMAN_REVIEWED_CANDIDATE"}]
        }
        self.write_bridge()
        self.out = self.root / "output"
        self.out.mkdir()
    def write_bridge(self):
        self.bridge.write_text(json.dumps(self.bridge_data))
    def run_pipeline(self, **kwargs):
        return pipeline.build(self.ifc, self.intake, self.preflight, self.bridge,
                              self.glb, self.out, "test-bridge", "concept-1",
                              **kwargs)
    def test_generates_usable_review_contract_and_real_node_links(self):
        review, features, placement = self.run_pipeline()
        self.assertEqual(review["schema"], "tsm.design-review.v1")
        self.assertEqual(review["source"]["sha256"], self.d)
        self.assertEqual(review["source"]["horizontalUnits"], "ftUS")
        self.assertEqual(review["placement"]["state"], "PENDING_EVIDENCE")
        self.assertEqual(len(review["elements"]), 2)
        self.assertEqual(len(features["bindings"]), 2)
        self.assertEqual(features["bindings"][0]["ifcGlobalId"], GUID_A)
        self.assertEqual(features["bindings"][0]["assetId"], "IGIO:fixture-A")
        self.assertEqual(features["bindings"][1]["ifcGlobalId"], GUID_B)
        self.assertFalse(features["meshIdentityIndependentlyVerified"])
        self.assertFalse(placement["modelOverlayPermitted"])
        self.assertFalse(placement["terrainClipPermitted"])
        self.assertEqual(json.loads((self.out/"design-review.json").read_text()), review)
    def test_unmapped_mesh_is_explicit_not_a_fabricated_link(self):
        self.glb.write_bytes(fake_glb([{"mesh": 0, "name": "arbitrary"}]))
        self.bridge_data["geometry"]["sha256"] = sha(self.glb.read_bytes())
        self.write_bridge()
        _, features, placement = self.run_pipeline()
        self.assertEqual(features["bindings"], [])
        self.assertEqual(features["unmappedMeshNodeCount"], 1)
        self.assertFalse(placement["modelOverlayPermitted"])
    def test_unknown_guid_refused_instead_of_assigned_from_order(self):
        self.glb.write_bytes(fake_glb([{"mesh": 0, "name": "2"*22}]))
        self.bridge_data["geometry"]["sha256"] = sha(self.glb.read_bytes())
        self.write_bridge()
        with self.assertRaisesRegex(ValueError, "UNKNOWN_IFC_GUID_IN_GLB"):
            self.run_pipeline()
    def test_all_hashes_must_match_actual_bytes(self):
        self.bridge_data["preflightSha256"] = "f"*64
        self.write_bridge()
        with self.assertRaisesRegex(ValueError, "PREFLIGHT_HASH_MISMATCH"):
            self.run_pipeline()
        self.bridge_data["preflightSha256"] = sha(self.preflight.read_bytes())
        self.bridge_data["geometry"]["sha256"] = "f"*64
        self.write_bridge()
        with self.assertRaisesRegex(ValueError, "GLB_HASH_MISMATCH"):
            self.run_pipeline()
    def write_controls(self, third_altitude=380.0, mixed_datum=False):
        survey = self.root / "survey-report.txt"
        survey.write_text("SYNTHETIC, NOT SURVEY EVIDENCE", encoding="utf-8")
        d = {
            "schema": "tsm.ifc-independent-control.v1",
            "sourceIfcSha256": self.d,
            "sourcePreflightSha256": sha(self.preflight.read_bytes()),
            "surveyReport": "survey-report.txt", "surveyReportSha256": sha(survey.read_bytes()),
            "sourceAuthority": "SYNTHETIC_ONLY", "coordinateEpoch": "2010.00",
            "horizontalCrs": "EPSG:2966", "horizontalUnits": "ftUS",
            "verticalDatum": "NGVD29" if mixed_datum else "NAVD88",
            "controlPoints": [
                {"id": "A", "localIfc": [0,0,0], "surveyMap": [1250000,750000,380]},
                {"id": "B", "localIfc": [1,0,0], "surveyMap": [1250000+3937/1200,750000,380]},
                {"id": "C", "localIfc": [0,1,0], "surveyMap": [1250000,750000+3937/1200,third_altitude]},
            ], "maxHorizontalRmseM": 0.10, "maxVerticalRmseM": 0.10,
        }
        p = self.root / "controls.json"
        p.write_text(json.dumps(d))
        return p
    def test_numeric_checkpoints_do_not_self_authorize_overlay(self):
        controls = self.write_controls()
        _, _, p = self.run_pipeline(control_path=controls)
        self.assertTrue(p["numericControlCheckPassed"])
        self.assertAlmostEqual(p["metrics"]["horizontalRmseM"],0,places=7)
        self.assertTrue(p["controlInputHashVerified"])
        self.assertFalse(p["surveyControlIndependentlyAuthenticated"])
        self.assertFalse(p["modelOverlayPermitted"])
        self.assertFalse(p["terrainClipPermitted"])
    def test_bad_residual_yields_visible_not_ready_state(self):
        controls = self.write_controls(third_altitude=390)
        _, _, p = self.run_pipeline(control_path=controls)
        self.assertFalse(p["numericControlCheckPassed"])
        self.assertGreater(p["metrics"]["verticalRmseM"],0.1)
    def test_vertical_datum_mismatch_refused_without_upgrading_evidence(self):
        controls = self.write_controls(mixed_datum=True)
        with self.assertRaisesRegex(ValueError,"CONTROL_FRAME_MISMATCH"):
            self.run_pipeline(control_path=controls)
    def test_no_outputs_left_after_invalid_source(self):
        self.intake.write_text(self.intake.read_text().replace(self.d,"f"*64))
        with self.assertRaisesRegex(ValueError,"checksum"):
            self.run_pipeline()
        self.assertEqual(list(self.out.iterdir()),[])
    def test_duplicate_mapping_is_not_assumed_valid(self):
        self.glb.write_bytes(fake_glb([{"mesh": 0,"name":GUID_A,"extras":{"ifcGlobalId":GUID_B}}]))
        self.bridge_data["geometry"]["sha256"]=sha(self.glb.read_bytes())
        self.write_bridge()
        with self.assertRaisesRegex(ValueError, "CONFLICTING_GLB_GUID"):
            self.run_pipeline()

    def test_missing_ifc_georeference_stays_unplaced_but_reviewable(self):
        obj=json.loads(self.preflight.read_text())
        obj["georeferencing"]["projectedCrs"]=None
        obj["georeferencing"]["mapConversion"]=None
        self.preflight.write_text(json.dumps(obj))
        self.bridge_data["preflightSha256"]=sha(self.preflight.read_bytes())
        self.write_bridge()
        review, features, placement=self.run_pipeline()
        self.assertEqual(review["placement"]["state"],"PENDING_EVIDENCE")
        self.assertTrue(review["source"]["crsDeclarationOnly"])
        self.assertFalse(placement["modelOverlayPermitted"])
        self.assertFalse(placement["terrainClipPermitted"])
        self.assertFalse(placement["ifcMapConversionDeclared"])
