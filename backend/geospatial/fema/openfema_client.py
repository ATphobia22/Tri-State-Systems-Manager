"""FEMA OpenFEMA API v2 client.

Public open-data API, no key required:
    https://www.fema.gov/api/open/v2/{DataSetName}

Verified live 2026-09-30. Datasets confirmed:
  - DisasterDeclarationsSummaries
  - FimaNfipPolicies
  - FimaNfipClaims
  - IndividualsAndHouseholdsProgramValidRegistrations

Fail-closed: transport or API failures return {"status": "UNAVAILABLE", ...},
never fabricated records. Stdlib only (urllib).
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone

OPENFEMA_BASE = "https://www.fema.gov/api/open/v2"

VERIFIED_DATASETS = (
    "DisasterDeclarationsSummaries",
    "FimaNfipPolicies",
    "FimaNfipClaims",
    "IndividualsAndHouseholdsProgramValidRegistrations",
)

_REQUEST_TIMEOUT_S = 60


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def query_dataset(
    dataset: str,
    odata_filter: str = "",
    select: str = "",
    orderby: str = "",
    top: int = 100,
    timeout: int = _REQUEST_TIMEOUT_S,
) -> dict:
    """Query an OpenFEMA v2 dataset with OData parameters.

    Returns {"status": "OBSERVED", "records": [...], "dataset": ...} or
    {"status": "UNAVAILABLE", "reason": ...}. Follows @odata.nextLink
    pagination up to a safety cap.
    """
    params: dict[str, str] = {"$metadata": "off"}
    if odata_filter:
        params["$filter"] = odata_filter
    if select:
        params["$select"] = select
    if orderby:
        params["$orderby"] = orderby
    if top:
        params["$top"] = str(top)

    records: list[dict] = []
    url = OPENFEMA_BASE + "/" + dataset + "?" + urllib.parse.urlencode(params)
    pages = 0
    try:
        while url and pages < 20:
            pages += 1
            req = urllib.request.Request(
                url, headers={"User-Agent": "TSM-openfema-client/1.0"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    return {
                        "status": "UNAVAILABLE",
                        "reason": "HTTP %s from OpenFEMA" % resp.status,
                        "dataset": dataset,
                    }
                payload = json.load(resp)
            batch = []
            for value in payload.values():
                if isinstance(value, list):
                    batch = value
                    break
            records.extend(batch)
            url = payload.get("@odata.nextLink") or payload.get("odata.nextLink")
        return {
            "status": "OBSERVED",
            "dataset": dataset,
            "records": records,
            "record_count": len(records),
            "retrieved_at": utc_now_iso(),
            "api": OPENFEMA_BASE,
        }
    except Exception as exc:  # fail-closed
        return {
            "status": "UNAVAILABLE",
            "reason": "OpenFEMA query failed: %s" % type(exc).__name__,
            "dataset": dataset,
        }


def posey_county_declarations() -> dict:
    """Federal disaster declarations designating Posey County, IN (FIPS 18129)."""
    return query_dataset(
        "DisasterDeclarationsSummaries",
        odata_filter="state eq 'IN' and fipsCountyCode eq '129'",
        select=(
            "disasterNumber,declarationDate,incidentType,declarationTitle,"
            "designatedArea,ihProgramDeclared,iaProgramDeclared,"
            "paProgramDeclared,hmProgramDeclared"
        ),
        orderby="declarationDate desc",
        top=100,
    )


def nfip_policies_posey_county(top: int = 100) -> dict:
    """NFIP policy records for Posey County, IN (countyCode 18129)."""
    return query_dataset(
        "FimaNfipPolicies",
        odata_filter="countyCode eq '18129'",
        select=(
            "nfipCommunityNumberCurrent,nfipCommunityName,ratedFloodZone,"
            "occupancyType,policyCount,policyEffectiveDate"
        ),
        top=top,
    )


if __name__ == "__main__":
    import sys

    which = sys.argv[1] if len(sys.argv) > 1 else "declarations"
    if which == "declarations":
        print(json.dumps(posey_county_declarations(), indent=2))
    else:
        print(json.dumps(nfip_policies_posey_county(), indent=2))
