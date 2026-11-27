import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from citybuilder import review_acceptance as gate


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj) + '\n')
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ReviewAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.source, self.build = root / 'source', root / 'build'
        self.build.mkdir()
        self.scene_sha = write(self.source / 'source/scene.json', {'buildings': {'features': [
            {'id': 'building-1', 'properties': {'source_feature_sha256': 'a' * 64}},
            {'id': 'building-2', 'properties': {'source_feature_sha256': 'b' * 64}},
        ]}})
        self.raw_sha = write(self.build / 'raw/tile.copc.laz', {'fixture': 'raw'})
        metric = write(self.build / 'metric.las', {'fixture': 'metric'})
        meta = write(self.build / 'source-metadata.html', {'fixture': 'metadata'})
        footprint = write(self.build / 'footprints.gpkg', {'fixture': 'footprints'})
        rasters = {name: {'sha256': write(self.build / f'{name}.tif', {'fixture': name})}
                   for name in ('dtm', 'dsm', 'ndsm')}
        self.prep = {'schema': 'tsm.pdal-reconstruction-review.v1',
                     'source_metadata_url': gate.METADATA, 'source_metadata_sha256': meta,
                     'source_tiles': {'tile.copc.laz': {'sha256': self.raw_sha, 'crs': [2968, 6360], 'point_count': 10}},
                     'metric_points': {'sha256': metric, 'crs': [2793, 5703], 'point_count': 8},
                     'rasters': rasters, 'footprints_sha256': footprint,
                     'point_class_1_is_unclassified': True, 'engineering_eligible': False, 'publication_eligible': False}
        prep_sha = write(self.build / 'preprocessing-receipt.json', self.prep)
        self.model = self.build / 'roofer-output/models.city.jsonl'
        self.model.parent.mkdir()
        self.header = {'type': 'CityJSON', 'transform': {'scale': [1, 1, 1], 'translate': [0, 0, 0]}}
        self.feature = {'type': 'CityJSONFeature', 'id': 'building-1',
                        'CityObjects': {'building-1': {'type': 'Building', 'geometry': [{'type': 'Solid', 'lod': '2.2'}]}}}
        self.model.write_text(json.dumps(self.header) + '\n' + json.dumps(self.feature) + '\n')
        self.roof = {'schema': 'tsm.roofer-source-linked-review.v1', 'scene_sha256': self.scene_sha,
                     'preprocessing_receipt_sha256': prep_sha, 'classification': 'UNCLASSIFIED_CLASS_1_EXPERIMENTAL',
                     'engineering_eligible': False, 'publication_eligible': False,
                     'file_sha256': {'models.city.jsonl': gate.digest(self.model)},
                     'records': [
                         {'tsm_id': 'building-1', 'source_feature_sha256': 'a' * 64, 'status': gate.CANDIDATE,
                          'roof_source_class': 1, 'engineering_eligible': False, 'publication_eligible': False},
                         {'tsm_id': 'building-2', 'source_feature_sha256': 'b' * 64, 'status': 'NO_RECONSTRUCTION',
                          'roof_source_class': 1, 'engineering_eligible': False, 'publication_eligible': False},
                     ], 'status_counts': {gate.CANDIDATE: 1, 'NO_RECONSTRUCTION': 1}}
        self.save()
        for name, value in [('PINNED_SCENE', self.scene_sha), ('PINNED_TILES', {'tile.copc.laz': self.raw_sha})]:
            p = patch.object(gate, name, value)
            p.start(); self.addCleanup(p.stop)
        for name in ('check_las', 'check_rasters', 'run_validator'):
            p = patch.object(gate, name)
            setattr(self, name, p.start()); self.addCleanup(p.stop)
        self.validator = root / 'validator'
        self.validator.write_bytes(b'unit test substitute')
        self.validator_sha = gate.digest(self.validator)

    def save(self):
        write(self.build / 'roof-review.json', self.roof)

    def audit(self):
        return gate.audit(self.source, self.build, self.validator, self.validator_sha)

    def test_valid_review_is_never_production_approval(self):
        result = self.audit()
        self.assertEqual(result['candidate_count'], 1)
        self.assertEqual(result['inventory_count'], 2)
        self.assertFalse(result['publication_eligible'])
        self.assertFalse(result['database_import_eligible'])
        self.assertEqual(self.run_validator.call_count, 1)
        self.assertEqual(self.check_las.call_count, 2)
        self.assertEqual(self.check_rasters.call_count, 1)

    def test_corrupted_raw_source_is_rejected(self):
        (self.build / 'raw/tile.copc.laz').write_bytes(b'bad')
        with self.assertRaises(gate.Blocked): self.audit()
        self.run_validator.assert_not_called()

    def test_missing_metric_cloud_is_rejected(self):
        (self.build / 'metric.las').unlink()
        with self.assertRaises(gate.Blocked): self.audit()

    def test_forged_publication_flag_is_rejected(self):
        self.roof['records'][0]['publication_eligible'] = True
        self.save()
        with self.assertRaises(gate.Blocked): self.audit()

    def test_duplicate_record_is_rejected(self):
        self.roof['records'][1] = self.roof['records'][0].copy()
        self.save()
        with self.assertRaises(gate.Blocked): self.audit()

    def test_unlisted_geometry_file_is_rejected(self):
        (self.model.parent / 'unlisted.city.jsonl').write_text(self.model.read_text())
        with self.assertRaises(gate.Blocked): self.audit()

    def test_unrecognized_feature_is_rejected_even_with_updated_hash(self):
        self.feature['id'] = 'other'
        self.model.write_text(json.dumps(self.header) + '\n' + json.dumps(self.feature) + '\n')
        self.roof['file_sha256']['models.city.jsonl'] = gate.digest(self.model)
        self.save()
        with self.assertRaises(gate.Blocked): self.audit()

    def test_symlink_geometry_is_rejected(self):
        content = self.model.read_bytes(); self.model.unlink()
        outside = Path(self.tmp.name) / 'outside.city.jsonl'; outside.write_bytes(content)
        self.model.symlink_to(outside)
        with self.assertRaises(gate.Blocked): self.audit()

    def test_report_requires_exact_valid_features_and_solid_counts(self):
        good = {'type': 'val3dity_report', 'val3dity_version': '2.7.0', 'validity': True,
                'all_errors': [], 'dataset_errors': [],
                'features': [{'id': 'building-1', 'type': 'Building', 'validity': True, 'errors': []}],
                'primitives_overview': [{'type': 'Solid', 'total': 1, 'valid': 1}]}
        gate.check_report(good, {'building-1'})
        for override in ({'validity': False}, {'features': []}, {'primitives_overview': []}, {'all_errors': [203]}, {'val3dity_version': 'unknown'}):
            with self.subTest(override=override), self.assertRaises(gate.Blocked):
                gate.check_report(dict(good, **override), {'building-1'})


class IndependentRuntimeTests(unittest.TestCase):
    def test_actual_raster_crs_units_and_lattice(self):
        import numpy as np
        import rasterio
        from pyproj import CRS
        from rasterio.transform import from_origin
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipts = {}
            for name in ('dtm', 'dsm', 'ndsm'):
                path = root / f'{name}.tif'
                crs = CRS.from_user_input('EPSG:2793' if name == 'ndsm' else 'EPSG:2793+5703')
                with rasterio.open(path, 'w', driver='GTiff', width=2, height=2, count=1,
                                   dtype='float32', transform=from_origin(1000, 1000, 1, 1),
                                   crs=crs.to_wkt(), nodata=-9999) as dst:
                    dst.write(np.ones((2, 2), dtype='float32'), 1)
                    dst.set_band_unit(1, 'm')
                    if name == 'ndsm':
                        dst.update_tags(TSM_POINT_SHA256='a'*64, TSM_Z_TYPE='RELATIVE_ABOVE_GROUND')
                    else:
                        dst.update_tags(TSM_POINT_SHA256='a'*64, TSM_Z_DATUM='NAVD88', TSM_Z_UNITS='m')
                receipts[name] = {'sha256': gate.digest(path), 'valid_count': 4}
            gate.check_rasters(root, receipts, 'a'*64)
            with rasterio.open(root / 'dtm.tif', 'r+') as ds:
                ds.set_band_unit(1, 'ft')
            receipts['dtm']['sha256'] = gate.digest(root / 'dtm.tif')
            with self.assertRaises(gate.Blocked): gate.check_rasters(root, receipts, 'a'*64)
