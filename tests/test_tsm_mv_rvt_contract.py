"""Pure tests for RVT dimension, height and contact blending contracts."""
import importlib.util
import unittest
from pathlib import Path

PATH = (Path(__file__).resolve().parents[1] /
        "tsm-native/Content/Python/tsm_mv_rvt_contract.py")
spec = importlib.util.spec_from_file_location("rvt_contract", PATH)
rvt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rvt)


class RvtContractTests(unittest.TestCase):
    def test_8km_default_is_not_262k_texel_naive_budget(self):
        result = rvt.virtual_resolution(**{
            "tile_size_px": rvt.DEFAULT_PROFILE["tile_size_px"],
            "log2_tiles": rvt.DEFAULT_PROFILE["log2_tiles"],
        })
        self.assertEqual(result["virtual_pixels_across"], 32768)
        self.assertAlmostEqual(result["meters_per_texel"], 8000 / 32768)
        self.assertIsNone(result["physical_vram_estimate"])
        self.assertTrue(result["requires_gpu_benchmark"])

    def test_requested_large_texture_is_research_only(self):
        profile = rvt.virtual_resolution(256, 10)
        self.assertEqual(profile["virtual_pixels_across"], 262144)
        self.assertGreater(profile["virtual_texels"], 60_000_000_000)
        self.assertIsNone(profile["physical_vram_estimate"])

    def test_contact_near_zero_and_above_35cm(self):
        self.assertEqual(rvt.foundation_blend_alpha(100, 100), 0.0)
        self.assertEqual(rvt.foundation_blend_alpha(135, 100), 1.0)
        self.assertEqual(rvt.foundation_blend_alpha(70, 100), 0.0)
        self.assertAlmostEqual(rvt.foundation_blend_alpha(117.5, 100), 0.5 ** 1.5)

    def test_height_mismatch_cancels_inappropriate_road_edge_blend(self):
        self.assertEqual(rvt.road_edge_alpha(0.0, 150, 150), 0.0)
        self.assertEqual(rvt.road_edge_alpha(1.0, 150, 150), 1.0)
        self.assertEqual(rvt.road_edge_alpha(0.0, 180, 150), 1.0)

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            rvt.virtual_resolution(64, 8)
        with self.assertRaises(ValueError):
            rvt.foundation_blend_alpha(1, 0, blend_height_cm=0)
        with self.assertRaises(ValueError):
            rvt.road_edge_alpha(1.1, 0, 0)
        with self.assertRaises(ValueError):
            rvt.height_quantization_cm(0)

    def test_worldheight_resolution_with_two_meter_z_span(self):
        self.assertAlmostEqual(rvt.height_quantization_cm(200), 200/65535)


if __name__ == "__main__":
    unittest.main()
