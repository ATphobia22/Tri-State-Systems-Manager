import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "tsm-native/Content/Python"
spec = importlib.util.spec_from_file_location("tsm_mv_environment_contract",
                                              ROOT / "tsm_mv_environment_contract.py")
env = importlib.util.module_from_spec(spec)
spec.loader.exec_module(env)


class MountVernonEnvironmentTest(unittest.TestCase):
    def test_central_daylight_time_in_july(self):
        p = env.preset("Summer_HighNoon")
        self.assertEqual(p["local_utc_offset_hours"], -5)
        self.assertTrue(p["is_daylight_saving_time"])
        self.assertEqual(p["weather_provenance"], "CINEMATIC_NOT_OBSERVED")
        self.assertIsNone(p["solar_elevation"])

    def test_central_standard_time_in_january(self):
        p = env.preset("Winter_BlueHour")
        self.assertEqual(p["local_utc_offset_hours"], -6)
        self.assertFalse(p["is_daylight_saving_time"])

    def test_wind_unit_direction_and_storm_strength(self):
        p = env.material_parameters("StormFront_Dusk")["vector"]["WindDirectionAndSpeed"]
        self.assertAlmostEqual(p[0]**2 + p[1]**2, 1.0)
        self.assertEqual(p[3], 0.85)

    def test_unknown_preset_fails(self):
        with self.assertRaises(ValueError):
            env.preset("RealObservedFlood_2026")


if __name__ == "__main__":
    unittest.main()
