#!/usr/bin/env python3
"""Public grant-source catalog contract: protect against bogus active-award claims."""
import json
from pathlib import Path
from urllib.parse import urlsplit

REGISTRY = Path(__file__).resolve().parents[2]/"data/registries/tsm-official-funding-portals-2026-10-26.json"
KINDS = {"federal_discovery","federal_api","federal_assistance_catalog",
"household_benefits","federal_awards_history","federal_submission","federal_agency",
"state_discovery","state_management","state_submission","state_agency","state_program","state_geospatial"}
NEEDED = {"grants-gov","simpler-grants","sam-assistance","usa-benefits","usaspending",
"justgrants","hhs-grants","ed-grants","eda","ntia","fema-grants",
"sba-grants","euna-ecivis","intelligrants","ocra-cdbg","oed","indot-rail","indiana-gio"}

def validate(data):
    assert data["schemaVersion"] == "tsm.funding-source-registry.v1"
    assert data["classification"] == "PUBLIC_SOURCE_METADATA"
    assert data["interpretation"]["deadlineRequiresOfficialNOFO"] is True
    sources = data["sources"]
    assert len(sources) >= 20
    ids, urls = set(), set()
    for row in sources:
        assert set(("id","name","category","url","capability","access","caveat",
                    "specificOpportunityStatus","isCurrentAwardOpportunity",
                    "isApprovedApplicant","allowsAutomatedSubmission")) <= set(row)
        assert row["id"] not in ids and row["url"] not in urls
        ids.add(row["id"]);urls.add(row["url"])
        assert row["category"] in KINDS
        parsed = urlsplit(row["url"])
        assert parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password
        assert not parsed.query and not parsed.fragment
        assert row["isCurrentAwardOpportunity"] is False
        assert row["isApprovedApplicant"] is False
        assert row["allowsAutomatedSubmission"] is False
        assert row["specificOpportunityStatus"] == "NOT_VERIFIED"
    assert NEEDED <= ids
    examples = data["examples"]
    for row in examples:
        assert row["sourceId"] in ids and row["reviewRequired"] is True
        assert row.get("deadline") or row.get("applicationDeadline") or row["status"] == "ROLLING_REBATE_NOT_GRANT"
        if "maxAwardUSD" in row: assert row["maxAwardUSD"] >= 0
    assert next(x for x in sources if x["id"] == "simpler-grants")["capability"] == "federal_opportunity_read_api"
    for entry in examples:
        if entry["sourceId"] == "oed" and "Rebate" in entry["program"]:
            assert entry["status"] == "ROLLING_REBATE_NOT_GRANT"
    return True

if __name__ == "__main__":
    validate(json.loads(REGISTRY.read_text()))
    print("Funding source catalog taxonomy and no-automatic-submission contract: PASS")
