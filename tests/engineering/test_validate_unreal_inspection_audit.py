import importlib.util
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[2] / "scripts/engineering/validate_unreal_inspection_audit.py"
SPEC = importlib.util.spec_from_file_location("inspection_validator", PATH)
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


def valid():
    return {"StructureID": "building-1", "SourceID": "verified-survey",
            "SourceSHA256": "a" * 64, "HorizontalCRS": "EPSG:2966",
            "VerticalDatum": "NAVD88", "ElevationUnits": "ftUS",
            "LAGSourceType": "surveyed_lag", "RuleID": "reviewed-local-rule",
            "RuleVerified": True, "FloodZoneIntersection": True,
            "LowestAdjacentGradeFt": 377.2, "BaseFloodElevationFt": 375.0,
            "RequiredFreeboardFt": 1.0, "ScreeningStatus": "THRESHOLD_MET",
            "FreeboardDeficitFt": 0.0}


class TestInspectionValidator(unittest.TestCase):
    def test_valid_threshold(self):
        self.assertEqual(MOD.validate_record(valid())["status"], "THRESHOLD_MET")

    def test_deficit(self):
        item = valid()
        item.update(LowestAdjacentGradeFt=374.0, ScreeningStatus="THRESHOLD_NOT_MET",
                    FreeboardDeficitFt=2.0)
        self.assertEqual(MOD.validate_record(item)["status"], "THRESHOLD_NOT_MET")

    def test_missing_bfe_is_not_zero(self):
        item = valid()
        del item["BaseFloodElevationFt"]
        self.assertEqual(MOD.validate_record(item)["status"], "NOT_EVALUATED")

    def test_unsurveyed_lag(self):
        item = valid()
        item["LAGSourceType"] = "lidar_estimate"
        self.assertEqual(MOD.validate_record(item)["status"], "NOT_EVALUATED")

    def test_mixed_datum(self):
        item = valid()
        item["VerticalDatum"] = "EGM2008"
        self.assertEqual(MOD.validate_record(item)["status"], "NOT_EVALUATED")

    def test_engine_disagreement(self):
        item = valid()
        item["ScreeningStatus"] = "THRESHOLD_NOT_MET"
        self.assertEqual(MOD.validate_record(item)["status"], "DISCREPANCY")

    def test_missing_zone_intersection(self):
        item = valid()
        item["FloodZoneIntersection"] = None
        self.assertEqual(MOD.validate_record(item)["status"], "NOT_EVALUATED")

    def test_nan_is_rejected(self):
        item = valid()
        item["BaseFloodElevationFt"] = float("nan")
        self.assertEqual(MOD.validate_record(item)["status"], "NOT_EVALUATED")

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            MOD.validate_document({"InspectedStructures": [valid(), valid()],
                                   "TotalInspectedCount": 2})


if __name__ == "__main__":
    unittest.main()
