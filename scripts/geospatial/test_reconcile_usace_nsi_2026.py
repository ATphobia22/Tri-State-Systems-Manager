#!/usr/bin/env python3
"""Synthetic tests only: no private coordinates, no network, no production data."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('nsi_qa', Path(__file__).with_name('reconcile_usace_nsi_2026.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def foot(oid=101, x=-87.9, y=38.0):
    return {'type': 'Feature', 'properties': {'objectid': oid},
            'geometry': {'type': 'Polygon', 'coordinates': [[
                [x, y], [x+.01, y], [x+.01, y+.01], [x, y+.01], [x,y]] ]}}


def point(nid=22, x=-87.895, y=38.005, fips='181290000000000', **props):
    return {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [x,y]},
            'properties': {'fd_id': nid, 'cbfips': fips, **props}}

class TestUSACENSIQA(unittest.TestCase):
    def run_compare(self, igio=None, nsi=None):
        igio = [foot()] if igio is None else igio
        nsi = [point()] if nsi is None else nsi
        return module.compare(igio,nsi,expected_count=len(igio))

    def test_unique_match_not_promoted_to_lidar(self):
        q = self.run_compare(nsi=[point(bldheight=5.2,ground_elv=377.0)])
        self.assertEqual(q['igioStatusCounts'], {'UNIQUE_CONTAINMENT_CANDIDATE_ONLY':1})
        self.assertEqual(q['candidateNsisWithHeightMeters'],1)
        self.assertEqual(q['candidateNsisWithGroundFeetNavd88'],1)
        self.assertFalse(q['nsiMeasurementsPromotedToLidar'])
        self.assertFalse(q['countywide3DTilesAccepted'])

    def test_invalid_polygon_is_not_silently_fixed(self):
        f=foot()
        f['geometry']['coordinates']=[[[-87.9,38.0],[-87.89,38.01],[-87.89,38.0],[-87.9,38.01],[-87.9,38.0]]]
        q=self.run_compare(igio=[f])
        self.assertEqual(q['invalidIgiosSourceObjectIds'],[101])
        self.assertEqual(q['igioStatusCounts'],{'INVALID_IGIO_GEOMETRY':1})

    def test_many_nsi_records_not_one_to_one(self):
        q=self.run_compare(nsi=[point(nid=1),point(nid=2)])
        self.assertEqual(q['multipleNsiPointsIgiosSourceObjectIds'],[101])
        self.assertEqual(q['igioStatusCounts'],{'MULTIPLE_NSI_POINTS_INSIDE_FOOTPRINT':1})
        self.assertEqual(q['candidateNsisWithHeightMeters'],0)

    def test_point_in_overlapping_polygons_is_ambiguous(self):
        q=self.run_compare(igio=[foot(101),foot(202)],nsi=[point()])
        self.assertEqual(q['nsiAmbiguousBetweenFootprints'],1)
        self.assertEqual(q['igioStatusCounts'],{'NO_UNAMBIGUOUS_NSI_MATCH':2})

    def test_out_of_county_is_rejected_as_match(self):
        q=self.run_compare(nsi=[point(fips='171810000000000')])
        self.assertEqual(q['nsiInputExclusions'],{'wrong_or_missing_cbfips':1})
        self.assertEqual(q['igioStatusCounts'],{'NO_UNAMBIGUOUS_NSI_MATCH':1})

    def test_duplicate_igio_id_fails(self):
        with self.assertRaises(module.InputError):
            self.run_compare(igio=[foot(),foot()],nsi=[])

    def test_duplicate_nsi_id_fails(self):
        with self.assertRaises(module.InputError):
            self.run_compare(nsi=[point(),point()])

    def test_boolean_height_is_not_numeric(self):
        q=self.run_compare(nsi=[point(bldheight=True,ground_elv=float('nan'))])
        self.assertEqual(q['candidateNsisWithHeightMeters'],0)
        self.assertEqual(q['candidateNsisWithGroundFeetNavd88'],0)

    def test_null_or_zero_heights_not_promoted(self):
        q=self.run_compare(nsi=[point(bldheight=0,ground_elv=None)])
        self.assertEqual(q['candidateNsisWithHeightMeters'],0)
        self.assertEqual(q['candidateNsisWithGroundFeetNavd88'],0)

    def test_ground_meters_and_feet_consistency(self):
        q=self.run_compare(nsi=[point(ground_elv=328.08399,grnd_elv_m=100.0)])
        self.assertEqual(q['comparisonCounts']['NSI_GROUND_UNITS_COMPARED'],1)
        self.assertNotIn('NSI_GROUND_UNITS_OUTSIDE_TOLERANCE',q['comparisonCounts'])

    def test_height_outlier_against_observed_lidar(self):
        local=foot()
        local['properties'].update(lidarHeightFt=20.0,
                                   lidarHeightStatus='OK',heightProvenance='OBSERVED')
        q=self.run_compare(igio=[local],nsi=[point(bldheight=15.0)])
        self.assertEqual(q['comparisonCounts']['NSI_VS_OBSERVED_LIDAR_HEIGHT_OUTSIDE_TOLERANCE'],1)
        self.assertFalse(q['nsiMeasurementsPromotedToLidar'])

    def test_no_comparison_against_unverified_lidar(self):
        local=foot()
        local['properties'].update(lidarHeightFt=20.0,
                                   lidarHeightStatus='UNVERIFIED',heightProvenance='SIMULATED')
        q=self.run_compare(igio=[local],nsi=[point(bldheight=15.0)])
        self.assertEqual(q['comparisonCounts'],{})

    def test_coordinate_redaction(self):
        import json
        q=self.run_compare()
        rendered=json.dumps(q)
        self.assertNotIn('-87.895',rendered)
        self.assertNotIn('38.005',rendered)
        self.assertNotIn('val_struct',rendered)

if __name__ == '__main__':
    unittest.main()
