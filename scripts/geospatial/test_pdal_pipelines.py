#!/usr/bin/env python3
"""Tests for the PDAL pipeline builders in pdal_pipelines.py.

Builders only produce JSON dicts, so these tests run without PDAL installed.
Nothing here executes a pipeline; PDAL >= 2.5 is required on the machine
that runs them (see pdal_pipelines.require_pdal).
"""
from __future__ import annotations

import json
import unittest

from pdal_pipelines import (
    BUILDERS,
    dem_pipeline,
    ept_to_laz_pipeline,
    ground_filter_pipeline,
    info_pipeline,
    pdal_available,
    require_pdal,
    thin_pipeline,
    building_vegetation_pipeline,
)


def _stages(pipeline):
    return pipeline["pipeline"]


def _smrf_stages(pipeline):
    return [s for s in _stages(pipeline) if s.get("type") == "filters.smrf"]


class ReaderSelectionTests(unittest.TestCase):
    def test_ept_json_selects_readers_ept(self):
        stages = _stages(ground_filter_pipeline("https://example.invalid/IN_2020/ept.json", "out.laz"))
        self.assertEqual(stages[0], {"type": "readers.ept", "filename": "https://example.invalid/IN_2020/ept.json"})

    def test_copc_laz_selects_readers_copc(self):
        stages = _stages(ground_filter_pipeline("tile.copc.laz", "out.laz"))
        self.assertEqual(stages[0]["type"], "readers.copc")

    def test_las_and_laz_select_readers_las(self):
        self.assertEqual(_stages(ground_filter_pipeline("tile.las", "o.laz"))[0]["type"], "readers.las")
        self.assertEqual(_stages(ground_filter_pipeline("tile.laz", "o.laz"))[0]["type"], "readers.las")

    def test_unknown_suffix_defaults_to_readers_las(self):
        stages = _stages(ground_filter_pipeline("tile.xyz", "o.laz"))
        self.assertEqual(stages[0]["type"], "readers.las")


class GroundFilterPipelineTests(unittest.TestCase):
    def test_drops_noise_and_withheld_before_classification(self):
        stages = _stages(ground_filter_pipeline("tile.laz", "ground.laz"))
        ranges = [s for s in stages if s.get("type") == "filters.range"]
        self.assertEqual(len(ranges), 1)
        self.assertIn("Classification![7:7]", ranges[0]["limits"])
        self.assertIn("Withheld![1:1]", ranges[0]["limits"])

    def test_smrf_stage_uses_repo_tuned_parameters(self):
        # Repo values (window 18, slope 0.2, threshold 0.45, scalar 1.2) are
        # PDAL-valid parameters, not PDAL defaults (slope 0.15, threshold
        # 0.5, scalar 1.25) — assert the repo's own values as-is.
        smrf = _smrf_stages(ground_filter_pipeline("tile.laz", "ground.laz"))
        self.assertEqual(len(smrf), 1)
        self.assertEqual(smrf[0]["window"], 18)
        self.assertEqual(smrf[0]["slope"], 0.2)
        self.assertEqual(smrf[0]["threshold"], 0.45)
        self.assertEqual(smrf[0]["scalar"], 1.2)

    def test_writes_las_and_is_json_serializable(self):
        pipeline = ground_filter_pipeline("tile.laz", "ground.laz")
        self.assertEqual(_stages(pipeline)[-1], {"type": "writers.las", "filename": "ground.laz"})
        json.dumps(pipeline)  # must not raise

    def test_bounds_adds_a_crop_stage_and_absent_bounds_adds_none(self):
        with_bounds = _stages(ground_filter_pipeline("tile.laz", "g.laz", bounds="([0,1],[0,1])"))
        self.assertTrue(any(s.get("type") == "filters.crop" for s in with_bounds))
        without_bounds = _stages(ground_filter_pipeline("tile.laz", "g.laz"))
        self.assertFalse(any(s.get("type") == "filters.crop" for s in without_bounds))


class DemPipelineTests(unittest.TestCase):
    def test_ground_only_keeps_class_2_then_writes_idw_geotiff(self):
        stages = _stages(dem_pipeline("tile.laz", "dem.tif"))
        self.assertEqual(len(_smrf_stages({"pipeline": stages})), 1)
        ranges = [s for s in stages if s.get("type") == "filters.range"]
        self.assertEqual([r["limits"] for r in ranges], ["Classification[2:2]"])
        writer = stages[-1]
        self.assertEqual(writer["type"], "writers.gdal")
        self.assertEqual(writer["filename"], "dem.tif")
        self.assertEqual(writer["output_type"], "idw")
        self.assertEqual(writer["data_type"], "float32")
        self.assertEqual(writer["nodata"], -9999)

    def test_ground_only_false_skips_classification_entirely(self):
        stages = _stages(dem_pipeline("tile.laz", "dem.tif", ground_only=False))
        self.assertEqual(_smrf_stages({"pipeline": stages}), [])
        self.assertFalse(any(s.get("type") == "filters.range" for s in stages))

    def test_resolution_is_passed_through(self):
        stages = _stages(dem_pipeline("tile.laz", "dem.tif", resolution=2.5))
        self.assertEqual(stages[-1]["resolution"], 2.5)
        stages_default = _stages(dem_pipeline("tile.laz", "dem.tif"))
        self.assertEqual(stages_default[-1]["resolution"], 1.0)


class BuildingVegetationPipelineTests(unittest.TestCase):
    def test_hag_then_assign_above_threshold_as_building(self):
        stages = _stages(building_vegetation_pipeline("tile.laz", "out.laz"))
        self.assertTrue(any(s.get("type") == "filters.hag_nn" for s in stages))
        assigns = [s for s in stages if s.get("type") == "filters.assign"]
        self.assertEqual(len(assigns), 1)
        self.assertEqual(
            assigns[0]["assignment"],
            "Classification[6:6] WHERE HeightAboveGround > 2.0",
        )

    def test_custom_hag_threshold_is_used_verbatim(self):
        stages = _stages(building_vegetation_pipeline("tile.laz", "out.laz", hag_threshold_m=6.56))
        assigns = [s for s in stages if s.get("type") == "filters.assign"]
        self.assertIn("HeightAboveGround > 6.56", assigns[0]["assignment"])

    def test_smrf_runs_before_hag(self):
        stages = _stages(building_vegetation_pipeline("tile.laz", "out.laz"))
        types = [s["type"] for s in stages]
        self.assertLess(types.index("filters.smrf"), types.index("filters.hag_nn"))


class ThinAndConvertPipelineTests(unittest.TestCase):
    def test_thin_keeps_every_nth_point_with_compression(self):
        stages = _stages(thin_pipeline("tile.laz", "thin.laz"))
        decimation = [s for s in stages if s.get("type") == "filters.decimation"]
        self.assertEqual(decimation, [{"type": "filters.decimation", "step": 2}])
        self.assertEqual(stages[-1], {"type": "writers.las", "filename": "thin.laz", "compression": True})
        stages_custom = _stages(thin_pipeline("tile.laz", "thin.laz", step=4))
        self.assertEqual(
            [s for s in stages_custom if s.get("type") == "filters.decimation"],
            [{"type": "filters.decimation", "step": 4}],
        )

    def test_ept_to_laz_uses_ept_reader_and_optional_resolution_and_bounds(self):
        stages = _stages(ept_to_laz_pipeline("https://example.invalid/ept.json", "tile.laz"))
        self.assertEqual(stages[0], {"type": "readers.ept", "filename": "https://example.invalid/ept.json"})
        self.assertFalse(any(s.get("type") == "filters.ept" for s in stages))
        stages_full = _stages(
            ept_to_laz_pipeline("https://example.invalid/ept.json", "tile.laz",
                                resolution=2.0, bounds="([0,1],[0,1])")
        )
        self.assertTrue(any(s.get("type") == "filters.ept" for s in stages_full))
        self.assertTrue(any(s.get("type") == "filters.crop" for s in stages_full))

    def test_info_pipeline_writes_text_to_stdout(self):
        stages = _stages(info_pipeline("tile.laz"))
        self.assertEqual(stages[-1], {"type": "writers.text", "filename": "STDOUT", "order": "X,Y,Z"})


class BuildersRegistryTests(unittest.TestCase):
    def test_builders_map_covers_all_documented_pipeline_kinds(self):
        self.assertEqual(
            set(BUILDERS),
            {"ground", "dem", "building-vegetation", "thin", "ept-to-laz"},
        )

    def test_all_builder_outputs_are_json_serializable(self):
        for name, builder in BUILDERS.items():
            with self.subTest(builder=name):
                if name == "ept-to-laz":
                    pipeline = builder("https://example.invalid/ept.json", "out.laz")
                else:
                    pipeline = builder("tile.laz", "out.laz")
                json.dumps(pipeline)


class PdalAvailabilityTests(unittest.TestCase):
    def test_require_pdal_raises_clearly_when_pdal_is_absent(self):
        if pdal_available():
            self.skipTest("PDAL is installed on this machine")
        with self.assertRaises(RuntimeError) as ctx:
            require_pdal()
        self.assertIn("PDAL is not installed", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
