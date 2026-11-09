"""Regression tests for bounded, finite survey imports (stdlib unittest)."""
import math
import unittest

from backend.survey.cogo import _point, forward
from backend.survey.landxml_import import parse_landxml


class SurveyInputSecurityTests(unittest.TestCase):
    def test_reject_nonfinite_cogo_points(self):
        for point in [(math.inf, 0), (-math.inf, 0), (0, math.nan)]:
            with self.subTest(point=point), self.assertRaises(ValueError):
                _point(point, "test")

    def test_reject_nonfinite_forward_inputs(self):
        for azimuth, distance in [(math.inf, 10), (0, math.inf), (math.nan, 10)]:
            with self.subTest(azimuth=azimuth, distance=distance), self.assertRaises(ValueError):
                forward((0, 0), azimuth, distance)

    def test_reject_nonfinite_landxml_point(self):
        xml = '<LandXML version="1.2"><CgPoints><CgPoint name="A">NaN 20</CgPoint></CgPoints></LandXML>'
        with self.assertRaises(ValueError):
            parse_landxml(xml)

    def test_reject_xml_dtd(self):
        xml = '<!DOCTYPE LandXML [<!ENTITY x "boom">]><LandXML version="1.2"/>'
        with self.assertRaisesRegex(ValueError, "LANDXML_DTD_NOT_ALLOWED"):
            parse_landxml(xml)

    def test_accept_finite_landxml_point(self):
        xml = '<LandXML version="1.2"><CgPoints><CgPoint name="A">10 20 30</CgPoint></CgPoints></LandXML>'
        result = parse_landxml(xml)
        self.assertEqual(result["cgpoints"][0]["x"], 20.0)
        self.assertEqual(result["cgpoints"][0]["y"], 10.0)


if __name__ == "__main__":
    unittest.main()
