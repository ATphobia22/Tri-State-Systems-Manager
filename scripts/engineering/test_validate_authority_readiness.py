"""Synthetic engineering evidence readiness tests. Never represent field surveys."""
from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.engineering.validate_authority_readiness import validate, hash_file


def evidence(root: Path, name: str, text: str = "TEST ONLY") -> dict:
    p = root / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return {"path": name, "sha256": hash_file(p)}


class SurveyGateTests(unittest.TestCase):
    def make_terrain(self, root: Path) -> dict:
        dem = evidence(root, "survey/source-dem.tif")
        report = evidence(root, "survey/survey-control-report.txt")
        distribution = evidence(root, "survey/checkpoint-distribution.txt")
        points = []
        for i in range(30):
            points.append({
                "id": f"TEST-{i:03d}",
                "horizontalCrs": "EPSG:2966",
                "verticalDatum": "NAVD88",
                "coordinateEpoch": "NAD83(2011) epoch 2010.00",
                "independent": True,
                "landCover": "VEGETATED" if i == 29 else "NONVEGETATED",
                "rasterHeightM": 101.0,
                "surveyHeightM": 101.03,
                "surveyUncertaintyM": 0.01
            })
        return {
            "kind": "terrain",
            "source": { "raster": dem, "horizontalCrs": "EPSG:2966",
                        "verticalDatum": "NAVD88", "verticalUnit": "m",
                        "qualityLevel": "QL2", "acquisitionDate": "2026-01-01",
                        "coordinateEpoch": "NAD83(2011) epoch 2010.00" },
            "survey": {"controlReport": report, "distributionReport": distribution,
                       "surveyMethod": "SYNTHETIC MOCK ONLY", "surveyorOfRecord": "TEST CASE ONLY",
                       "surveyDate": "2026-01-01",
                       "independenceStatement": "TEST FIXTURES ONLY; NOT REAL CHECKPOINTS",
                       "checkpoints": points},
            "areaKm2": 10, "rasterCoverageKm2": 12,
        }

    def test_terrain_strict_metadata_ready_is_never_certification(self):
        with tempfile.TemporaryDirectory() as d:
            result = validate(self.make_terrain(Path(d)), Path(d))
            self.assertEqual(result["status"], "TECHNICAL_EVIDENCE_READY_FOR_HUMAN_REVIEW")
            self.assertFalse(result["approved"])
            self.assertIsNone(result["professionalCertification"])
            self.assertIsNone(result["regulatoryDetermination"])
            self.assertAlmostEqual(result["metrics"]["nonvegetatedRmseM"], 0.03)
            self.assertGreater(result["metrics"]["conservativeRmseIncludingCheckpointUncertaintyM"], 0.03)

    def test_fewer_than_thirty_cannot_pass(self):
        with tempfile.TemporaryDirectory() as d:
            bundle = self.make_terrain(Path(d))
            bundle["survey"]["checkpoints"] = bundle["survey"]["checkpoints"][:20]
            result = validate(bundle, Path(d))
            self.assertEqual(result["status"], "INCOMPLETE")
            self.assertTrue(any("at least 30" in e for e in result["errors"]))

    def test_wrong_datum_and_missing_survey_control_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            bundle = self.make_terrain(Path(d))
            bundle["source"]["verticalDatum"] = "ELLIPSOIDAL_NAD83_2011"
            bundle["survey"]["controlReport"] = {"path": "missing.pdf", "sha256": "0" * 64}
            report = validate(bundle, Path(d))
            self.assertEqual(report["status"], "INCOMPLETE")
            self.assertTrue(any("ellipsoidal" in e for e in report["errors"]))
            self.assertTrue(any("source evidence unavailable" in e for e in report["errors"]))

    def test_checkpoint_epoch_conflict_blocks_survey(self):
        with tempfile.TemporaryDirectory() as d:
            bundle = self.make_terrain(Path(d))
            bundle["survey"]["checkpoints"][0]["coordinateEpoch"] = "ITRF2020 epoch 2020.00"
            result = validate(bundle, Path(d))
            self.assertEqual(result["status"], "INCOMPLETE")
            self.assertTrue(any("coordinate epoch" in e for e in result["errors"]))

    def test_missing_feet_normalization_evidence_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            bundle = self.make_terrain(Path(d))
            bundle["source"]["verticalUnit"] = "us-ft"
            report = validate(bundle, Path(d))
            self.assertTrue(any("heightUnitNormalizationEvidence" in e for e in report["errors"]))

    def test_bad_checksum_and_symlink_escape_blocked(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            bundle = self.make_terrain(root)
            bundle["source"]["raster"]["sha256"] = "1" * 64
            first = validate(bundle, root)
            self.assertTrue(any("checksum mismatch" in e for e in first["errors"]))
            bundle["source"]["raster"]["path"] = "../elsewhere.txt"
            second = validate(bundle, root)
            self.assertTrue(any("path must remain" in e for e in second["errors"]))

    def test_duplicate_checkpoint_ids_are_blocked(self):
        with tempfile.TemporaryDirectory() as d:
            bundle = self.make_terrain(Path(d))
            bundle["survey"]["checkpoints"][2]["id"] = "TEST-001"
            res = validate(bundle, Path(d))
            self.assertTrue(any("duplicate checkpoint" in e for e in res["errors"]))


class TerrainSeamGateTests(unittest.TestCase):
    def mesh_bundle(self, root: Path) -> dict:
        directions = ["+x", "-x", "+y", "-y", "+z", "-z"]
        artifact = evidence(root, "mesh/geometry.glb", "SYNTHETIC MESH BYTES ONLY")
        boundary = evidence(root, "mesh/county-boundary.geojson", "SYNTHETIC BOUNDARY")
        sources = [evidence(root, "mesh/a.tif"), evidence(root, "mesh/b.tif")]
        seam_payload = {
            "schemaVersion": "tsm.geometric-seam-audit.v1",
            "status": "MEASURED_SEAM_SEGMENTS_MATCH_FOR_REVIEW",
            "errors": [], "interfacePairsSubmitted": 6, "matchedInterfaces": 6,
            "verifiedDirections": sorted(directions)
        }
        audit = evidence(root, "mesh/seam-audit.json", json.dumps(seam_payload))
        bundle = {
            "kind": "mesh",
            "meshArtifact": artifact,
            "seamAudit": audit,
            "countyBoundary": boundary,
            "sourceTiles": sources,
            "extractionMode": "FULL_ADAPTIVE_OCTREE",
            "countyAreaKm2": 1087, "coveredAreaKm2": 1087,
            "twoToOneBalanced": True,
            "verifiedSeamDirections": directions,
            "seamPairsChecked": 6,
            "trueCrackCount": 0, "nonManifoldEdges": 0,
            "unexplainedNoDataSeams": 0, "orphanTriangles": 0,
            "meshRecomputedAgainstSource": True,
            "deterministicRepeatHashMatch": True,
            "datumAlignmentVerified": True,
        }
        keys = ("extractionMode", "countyAreaKm2", "coveredAreaKm2", "twoToOneBalanced",
                "verifiedSeamDirections", "seamPairsChecked", "trueCrackCount",
                "nonManifoldEdges", "unexplainedNoDataSeams", "orphanTriangles",
                "meshRecomputedAgainstSource", "deterministicRepeatHashMatch",
                "datumAlignmentVerified")
        measured = {key: bundle[key] for key in keys}
        measured.update({
            "schemaVersion": "tsm.full-county-mesh-measurement.v1",
            "meshArtifactSha256": artifact["sha256"],
            "seamAuditSha256": audit["sha256"],
            "countyBoundarySha256": boundary["sha256"],
            "sourceTileSha256": sorted(t["sha256"] for t in sources)
        })
        bundle["runReport"] = evidence(root, "mesh/run-report.json", json.dumps(measured))
        return bundle

    def test_complete_technical_claim_is_still_not_certification(self):
        with tempfile.TemporaryDirectory() as d:
            r = validate(self.mesh_bundle(Path(d)), Path(d))
            self.assertEqual(r["status"], "TECHNICAL_EVIDENCE_READY_FOR_HUMAN_REVIEW")
            self.assertFalse(r["approved"])

    def test_existing_bounded_face_model_cannot_be_called_county_complete(self):
        with tempfile.TemporaryDirectory() as d:
            bundle = self.mesh_bundle(Path(d))
            bundle.update(extractionMode="TRANSITION_FACE_STRIPS", coveredAreaKm2=400,
                          verifiedSeamDirections=["+y", "-y"], unexplainedNoDataSeams=7)
            report = validate(bundle, Path(d))
            self.assertEqual(report["status"], "INCOMPLETE")
            self.assertTrue(any("full adaptive-octree" in e for e in report["errors"]))
            self.assertTrue(any("county-wide" in e for e in report["errors"]))
            self.assertTrue(any("all six" in e for e in report["errors"]))

    def test_report_does_not_match_modified_mesh_or_seam_hash(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            bundle = self.mesh_bundle(root)
            (root / "mesh/geometry.glb").write_bytes(b"ALTERED MESH")
            result = validate(bundle, root)
            self.assertEqual(result["status"], "INCOMPLETE")
            self.assertTrue(any("checksum mismatch" in x for x in result["errors"]))

    def test_false_or_partial_seam_audit_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            bundle = self.mesh_bundle(root)
            bundle["seamPairsChecked"] = 17162
            result = validate(bundle, root)
            self.assertEqual(result["status"], "INCOMPLETE")
            self.assertTrue(any("seamAudit: actual matched interface" in x for x in result["errors"]))

    def test_true_crack_or_missing_source_hash_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            bundle = self.mesh_bundle(Path(d))
            bundle["trueCrackCount"] = 1
            bundle["sourceTiles"][0]["sha256"] = "0" * 64
            r = validate(bundle, Path(d))
            self.assertTrue(any("trueCrackCount" in e for e in r["errors"]))
            self.assertTrue(any("checksum mismatch" in e for e in r["errors"]))


class FloodwayGateTests(unittest.TestCase):
    def models(self, root: Path) -> dict:
        return {
            name: {
                "input": evidence(root, f"ras/{name}/input.hdf"),
                "output": evidence(root, f"ras/{name}/output.hdf"),
                "softwareVersion": "HEC-RAS TEST STUB",
                "runTimestamp": "2026-01-01T00:00:00Z",
                "solverSucceeded": True,
            }
            for name in ("effective", "duplicateEffective", "correctedEffective", "proposed")
        }

    def build(self, root: Path) -> dict:
        return {
            "kind": "floodway",
            "regulatoryContext": {
                "community": "SYNTHETIC_TEST", "effectiveFirmPanel": "TEST_PANEL",
                "firmEffectiveDate": "2014-11-05", "isFemaRegulatoryFloodway": True,
                "firmOrFaraSource": evidence(root, "firm/authority.txt"),
                "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88", "verticalUnit": "ft",
            },
            "models": self.models(root),
            "waterSurfaceComparisons": [
                {"crossSectionId": "X1", "effectiveOrCorrectedWseFt": 300.0,
                 "proposedWseFt": 300.0, "verticalDatum": "NAVD88", "verticalUnit": "ft"}
            ],
            "engineeringReviewDocument": evidence(root, "review/signature.txt"),
            "licensedReviewer": "SYNTHETIC UNIT TEST",
            "hydrologyAndBoundaryConditionsVerified": True,
            "modelComparisonVerified": True,
        }

    def test_zero_computed_rise_does_not_approve(self):
        with tempfile.TemporaryDirectory() as d:
            r = validate(self.build(Path(d)), Path(d))
            self.assertEqual(r["status"], "TECHNICAL_EVIDENCE_READY_FOR_HUMAN_REVIEW")
            self.assertFalse(r["approved"])
            self.assertIsNone(r["regulatoryDetermination"])
            self.assertEqual(r["metrics"]["maximumComputedRiseFt"], 0)

    def test_positive_rise_flags_fema_path_even_under_state_surcharge(self):
        with tempfile.TemporaryDirectory() as d:
            b = self.build(Path(d))
            b["waterSurfaceComparisons"][0]["proposedWseFt"] += 0.04
            r = validate(b, Path(d))
            self.assertTrue(r["metrics"]["femaFloodwayAnyIncreaseFlag"])
            self.assertFalse(r["approved"])

    def test_missing_effective_model_or_datum_conflict_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            b = self.build(Path(d))
            del b["models"]["effective"]
            b["waterSurfaceComparisons"][0]["verticalDatum"] = "NGVD29"
            r = validate(b, Path(d))
            self.assertEqual(r["status"], "INCOMPLETE")
            self.assertTrue(any("models.effective" in x for x in r["errors"]))
            self.assertTrue(any("datum-consistent" in x for x in r["errors"]))

    def test_unresolvable_evidence_and_no_model_is_incomplete(self):
        with tempfile.TemporaryDirectory() as d:
            r = validate({"kind": "floodway"}, Path(d))
            self.assertEqual(r["status"], "INCOMPLETE")
            self.assertFalse(r["approved"])
            self.assertIsNone(r["metrics"]["femaFloodwayAnyIncreaseFlag"])
            self.assertEqual(r["metrics"]["reviewPath"], "REGULATORY_APPLICABILITY_UNVERIFIED")


if __name__ == "__main__":
    unittest.main()
