"""Regression coverage for bounded EPT grouping and original footprint order."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

from scripts.geospatial import extract_lidar_heights as ept


class EptNodeBatchTests(unittest.TestCase):
    def test_shared_source_node_is_read_once_and_output_order_is_preserved(self):
        ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
        features = [
            {"geometry": {"type": "Polygon", "coordinates": [ring]}, "properties": {"igioObjectId": nid}}
            for nid in (93, 81, 65)
        ]
        las = SimpleNamespace(
            x=np.full(14, 5.0), y=np.full(14, 5.0),
            z=np.array([100.0] * 3 + [106.0] * 5 + [120.0] * 6),
            classification=np.array([2] * 3 + [6] * 5 + [8] * 6),
        )
        with TemporaryDirectory() as directory:
            source = Path(directory) / "source.json"
            output = Path(directory) / "output.json"
            source.write_text(json.dumps({"features": features}))
            with patch.object(ept, "EPTReader") as reader:
                instance = reader.return_value
                instance.lonlat_to_native.side_effect = lambda x, y: (x, y)
                instance.node_for_point.return_value = "6-1-1-31"
                instance.read_node.return_value = las
                instance.native_crs = "EPSG:3857"
                instance.root_bounds = [0, 0, 0, 100, 100, 100]
                stats = ept.extract_heights(source, output, ept.DEFAULT_EPT)
                instance.read_node.assert_called_once_with("6-1-1-31")
            rows = [feature["properties"] for feature in json.loads(output.read_text())["features"]]
            self.assertEqual([row["igioObjectId"] for row in rows], [93, 81, 65])
            self.assertEqual([row["lidarHeightM"] for row in rows], [6.0] * 3)
            self.assertEqual(stats["with_height"], 3)
            self.assertTrue(all(row["lidarRoofPoints"] == 5 for row in rows))
            self.assertEqual(stats["class_histogram"], {"2": 9, "6": 15, "8": 18})

    def test_batches_never_exceed_node_budget_or_drop_a_group(self):
        groups = {(str(i), str(i + 1)): [i] for i in range(50)}
        batches = list(ept.node_batches(groups))
        self.assertGreater(len(batches), 1)
        self.assertEqual(dict(pair for _, batch in batches for pair in batch), groups)
        for nodes, batch in batches:
            self.assertEqual(nodes, {node for key, _ in batch for node in key})
            self.assertLessEqual(len(nodes), ept.MAX_NODES_PER_BATCH)

    def test_root_hierarchy_is_fetched_and_indexed_once(self):
        node = "6-0-0-31"
        with patch.object(ept, "fetch_json", side_effect=[
            {"bounds": [0, 0, 0, 64, 64, 64], "srs": "EPSG:3857"}, {node: 8},
        ]) as fetch:
            reader = ept.EPTReader(ept.DEFAULT_EPT)
            for _ in range(5):
                self.assertEqual(reader.node_for_point(0.5, 0.5, 6), node)
            self.assertEqual(fetch.call_count, 2)
