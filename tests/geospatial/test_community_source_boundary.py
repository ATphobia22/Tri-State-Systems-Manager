import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend.gov import site_constants
from backend.api.v1 import twin_router


class CommunitySourceBoundaryTests(unittest.TestCase):
    def test_public_constants_exclude_project_specific_defaults(self):
        result = twin_router.constants()
        for key in ('parcel_apn', 'address', 'latitude', 'longitude', 'bfe_ft', 'lag_ft', 'ffe_ft', 'berm_crest_ft'):
            self.assertNotIn(key, result)
        self.assertEqual(result['vertical_datum'], 'UNVERIFIED')
        self.assertTrue(result['project_evidence_required'])
        self.assertTrue(result['human_review_required'])
        self.assertIsNone(result['regulatory_determination'])
        site_constants.assert_invariants()

    def test_absent_proposal_evidence_fails_all_screening_checks(self):
        results = twin_router.evaluate_gates(twin_router.DesignProposal())
        self.assertEqual(len(results), 5)
        self.assertFalse(any(r.passed for r in results))

    def test_invalid_numeric_values_do_not_pass(self):
        for value in (True, '3.0', float('nan'), float('inf'), 10**1000):
            with self.subTest(value=type(value).__name__):
                results = twin_router.evaluate_gates(twin_router.DesignProposal(bishop_fos=value, slope_ratio=value))
                self.assertFalse(results[1].passed)
                self.assertFalse(results[2].passed)

    def test_screening_cannot_satisfy_missing_bfe_evidence(self):
        results = twin_router.evaluate_gates(twin_router.DesignProposal(intersects_floodway=False, bishop_fos=1.5, slope_ratio=3.0, within_811_buffer_m=False))
        self.assertTrue(all(r.passed for r in results[:4]))
        self.assertFalse(results[4].passed)


if __name__ == '__main__':
    unittest.main()
