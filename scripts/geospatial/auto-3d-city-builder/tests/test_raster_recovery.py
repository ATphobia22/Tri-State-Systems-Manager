import numpy as np
import pytest
from citybuilder.raster_recovery import assess_height, assess_contact, z_factor

def test_corroborated_raster_height_is_review_only():
    r=assess_height([8,8,9,9],[8,9,8,9],4)
    assert r["status"]=="RASTER_HEIGHT_CANDIDATE"
    assert r["height_m"]==8.5
    assert r["engineering_eligible"] is False

def test_disagreement_and_missing_units_do_not_invent_height():
    assert assess_height([8]*4,[2]*4,4)["status"]=="RASTER_DISAGREEMENT"
    assert assess_height([],[],4)["status"]=="INSUFFICIENT_RASTER_COVERAGE"
    assert z_factor(None,None) is None
    assert z_factor("US survey foot",None)==pytest.approx(1200/3937)
    assert z_factor("ft",None) is None

def test_contact_mismatch_and_missing_samples_are_distinct():
    assert assess_contact(100,[100,101],2,0.5)["status"]=="MISMATCH"
    assert assess_contact(100,[100],2,0.5)["status"]=="INCOMPLETE"
    assert assess_contact(100,[100,100.1],2,0.5)["status"]=="WITHIN_DIAGNOSTIC_TOLERANCE"
