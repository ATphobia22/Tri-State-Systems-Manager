import unittest
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import retry_adjacent_copc_heights as retry


class AdjacentTileRecoveryTests(unittest.TestCase):
    polygons = [[[(4990, 2000), (5010, 2000), (5010, 2020), (4990, 2020), (4990, 2000)]]]

    def setUp(self):
        self.features = [
            {'properties': {'igioObjectId': 7, 'lidarHeightStatus': 'insufficient-ground-points:5'},
             'geometry': {}},
            {'properties': {'igioObjectId': 9, 'lidarHeightStatus': 'OK', 'heightProvenance': 'OBSERVED'},
             'geometry': {}},
        ]

    def points(self, path, grid):
        x = 4995 if grid == (0, 0) else 5005
        # Both inputs offer copies of one roof point in the east tile. The west copy is excluded.
        return tuple(np.array(column) for column in (
            [x] * 10 + [5007], [2010] * 11, [100] * 5 + [120] * 6, [2] * 5 + [1] * 6,
        ))

    def run_recovery(self, reader):
        with TemporaryDirectory() as directory, \
                patch.object(retry, 'get_footprint_polygons_spw', return_value=self.polygons), \
                patch.object(retry, 'download_tile', return_value='a' * 64), \
                patch.object(retry, 'read_source', side_effect=reader):
            return retry.recover(self.features, Path(directory), keep_tiles=True)

    def test_combines_ground_and_roof_returns_without_duplicate_tile_overlap(self):
        receipt = self.run_recovery(self.points)
        properties = self.features[0]['properties']
        self.assertEqual(receipt['recoveredBuildings'], 1)
        self.assertEqual(properties['lidarHeightFt'], 20.0)
        self.assertEqual(properties['lidarGroundPoints'], 10)
        self.assertEqual(properties['lidarRoofPoints'], 11)
        self.assertEqual([source['sha256'] for source in properties['lidarSourceTiles']], ['a' * 64] * 2)
        self.assertEqual(properties['igioObjectId'], 7)
        self.assertEqual(self.features[1]['properties']['heightProvenance'], 'OBSERVED')

    def test_incomplete_source_window_cannot_promote_height(self):
        def incomplete(path, grid):
            if grid == (1, 0):
                raise OSError('no source object')
            return self.points(path, grid)

        receipt = self.run_recovery(incomplete)
        self.assertEqual(receipt['incompleteTileSourceBuildings'], 1)
        self.assertEqual(receipt['recoveredBuildings'], 0)
        self.assertEqual(self.features[0]['properties']['lidarHeightStatus'], 'insufficient-ground-points:5')

    def test_ground_buffer_reaches_diagonal_neighbor(self):
        self.assertEqual(retry.intersecting_grids([(4960, 4960, 5030, 5030)]),
                         {(0, 0), (0, 1), (1, 0), (1, 1)})


if __name__ == '__main__':
    unittest.main()
