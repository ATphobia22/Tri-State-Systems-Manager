"""Reject invalid numeric survey inputs before vendored solver or XML conversion."""
import math
import pytest
from backend.survey.cogo import inverse, forward
from backend.survey.landxml_import import parse_landxml

def test_cogo_rejects_infinite_easting():
    with pytest.raises(ValueError, match="non-finite"):
        inverse((math.inf, 0.0), (10.0, 10.0))

def test_cogo_rejects_infinite_direction_and_distance():
    with pytest.raises(ValueError, match="must be finite"):
        forward((0.0, 0.0), math.inf, 10.0)
    with pytest.raises(ValueError, match="must be finite"):
        forward((0.0, 0.0), 10.0, math.inf)

def test_landxml_rejects_nonfinite_coordinates():
    xml='<LandXML version="1.2"><CgPoints><CgPoint name="A">Infinity 123</CgPoint></CgPoints></LandXML>'
    with pytest.raises(ValueError, match="non-finite"):
        parse_landxml(xml)

def test_landxml_rejects_dtd_entity_expansion():
    xml='<!DOCTYPE LandXML [<!ENTITY a "123">]><LandXML version="1.2"><CgPoints><CgPoint name="A">&a; 456</CgPoint></CgPoints></LandXML>'
    with pytest.raises(ValueError, match="LANDXML_DTD_NOT_ALLOWED"):
        parse_landxml(xml)

def test_landxml_rejects_oversized_payload():
    with pytest.raises(ValueError, match="LANDXML_INPUT_TOO_LARGE"):
        parse_landxml('<LandXML>'+(' '*50_000_000)+'</LandXML>')
