"""Unit tests for the PMTiles builder; no external geospatial tools required."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.geospatial import build_pmtiles


class BuildPmtilesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.input_path = self.root / "input.geojson"
        self.input_path.write_text(
            '{"type":"FeatureCollection","features":[]}', encoding="utf-8"
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _fake_tippecanoe(self, command: list[str], check: bool) -> None:
        self.assertTrue(check)
        output = Path(command[2])
        output.write_bytes(b"pmtiles-test-archive")

    @patch("scripts.geospatial.build_pmtiles.subprocess.run")
    def test_builds_pmtiles_directly_and_honors_custom_output(self, run_mock) -> None:
        run_mock.side_effect = self._fake_tippecanoe
        output = self.root / "custom-output.pmtiles"
        result = build_pmtiles.build_layer(
            "test-layer",
            {
                "input": str(self.input_path),
                "minzoom": 10,
                "maxzoom": 14,
                "layer_name": "test-layer",
                "attribution": "Test source",
            },
            output_path=output,
        )
        self.assertEqual(result, output)
        self.assertTrue(output.is_file())
        command = run_mock.call_args.args[0]
        self.assertEqual(command[0], "tippecanoe")
        self.assertEqual(command[1:3], ["--output", str(output)])
        self.assertTrue(str(output).endswith(".pmtiles"))
        self.assertNotIn("pmtiles", command[0:1])

    @patch("scripts.geospatial.build_pmtiles.subprocess.run")
    def test_rejects_invalid_zoom_range_before_invoking_tool(self, run_mock) -> None:
        with self.assertRaises(ValueError):
            build_pmtiles.build_layer(
                "test-layer",
                {
                    "input": str(self.input_path),
                    "minzoom": 15,
                    "maxzoom": 10,
                    "layer_name": "test-layer",
                },
                output_path=self.root / "bad.pmtiles",
            )
        run_mock.assert_not_called()

    @patch("scripts.geospatial.build_pmtiles.subprocess.run")
    def test_rejects_non_pmtiles_output_extension(self, run_mock) -> None:
        with self.assertRaises(ValueError):
            build_pmtiles.build_layer(
                "test-layer",
                {
                    "input": str(self.input_path),
                    "minzoom": 10,
                    "maxzoom": 12,
                    "layer_name": "test-layer",
                },
                output_path=self.root / "output.mbtiles",
            )
        run_mock.assert_not_called()

    def test_missing_input_is_skipped_without_external_tool(self) -> None:
        result = build_pmtiles.build_layer(
            "missing",
            {
                "input": str(self.root / "missing.geojson"),
                "minzoom": 10,
                "maxzoom": 12,
                "layer_name": "missing",
            },
            output_path=self.root / "missing.pmtiles",
        )
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
