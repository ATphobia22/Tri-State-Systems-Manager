"""Bounded, auditable FEMA OpenFEMA read-only client.

Administrative FEMA records are not effective NFHL geometry, certified
surveys, approved hydraulic models, current warnings, or grant eligibility.
Do not follow untrusted server-provided nextLink URLs; use local $top/$skip.
Never report truncated or failed pagination as a complete retrieval.
"""
from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone

OPENFEMA_ROOT = "https://www.fema.gov/api/open"
OPENFEMA_BASE = OPENFEMA_ROOT + "/v2"  # legacy public constant
# Aligned with repository data/fema/openfema-catalog.json, 2026-11-16.
# Keys map to (API version, deprecated). Superseded v2 policy/claim
# endpoints remain explicit solely for compatibility, not new ingest.
DATASET_VERSIONS = {
    "DisasterDeclarationsSummaries": (2, False),
    "FemaRegions": (2, False),
    "HmaSubapplications": (2, False),
    "HazardMitigationGrantProgramDisasterSummaries": (3, False),
    "NfipPolicies": (3, False),
    "NfipClaims": (3, False),
    "FimaNfipPolicies": (2, True),
    "FimaNfipClaims": (2, True),
    "IndividualsAndHouseholdsProgramValidRegistrations": (2, False),
}
VERIFIED_DATASETS = tuple(DATASET_VERSIONS)
_REQUEST_TIMEOUT_S = 30
_MAX_RESPONSE_BYTES = 8 * 1024 * 1024
_SAFE_SELECT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(?:,[A-Za-z_][A-Za-z0-9_]*)*\Z")
_SAFE_ORDERBY = re.compile(
    r"[A-Za-z_][A-Za-z0-9_]*(?: (?:asc|desc))?"
    r"(?:, *[A-Za-z_][A-Za-z0-9_]*(?: (?:asc|desc))?)*\Z", re.IGNORECASE,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _request_url(dataset: str, version: int, odata_filter: str, select: str,
                 orderby: str, top: int, skip: int) -> str:
    params = {"$metadata": "true", "$top": str(top), "$skip": str(skip), "$format": "json"}
    if odata_filter:
        params["$filter"] = odata_filter
    if select:
        params["$select"] = select
    if orderby:
        params["$orderby"] = orderby
    return f"{OPENFEMA_ROOT}/v{version}/{dataset}?" + urllib.parse.urlencode(params)


def _validate(dataset, odata_filter, select, orderby, top, timeout, max_pages, max_records):
    if dataset not in DATASET_VERSIONS:
        raise ValueError("OpenFEMA dataset not allowlisted")
    if type(top) is not int or not 1 <= top <= 10000:
        raise ValueError("top must be an integer from 1 to 10000")
    if type(timeout) not in (int, float) or not 0 < timeout <= 120:
        raise ValueError("timeout must be > 0 and <= 120 seconds")
    if type(max_pages) is not int or not 1 <= max_pages <= 100:
        raise ValueError("max_pages must be an integer from 1 to 100")
    if type(max_records) is not int or not 1 <= max_records <= 100000:
        raise ValueError("max_records must be an integer from 1 to 100000")
    if (not isinstance(odata_filter, str) or len(odata_filter) > 2000 or
            "\n" in odata_filter or "\r" in odata_filter):
        raise ValueError("Invalid OpenFEMA filter")
    if not isinstance(select, str) or (select and not _SAFE_SELECT.fullmatch(select)):
        raise ValueError("Invalid OpenFEMA select")
    if not isinstance(orderby, str) or (orderby and not _SAFE_ORDERBY.fullmatch(orderby)):
        raise ValueError("Invalid OpenFEMA orderby")


def _fetch_page(url: str, timeout: float) -> bytes:
    req = urllib.request.Request(
        url, headers={"Accept": "application/json",
                      "User-Agent": "Tri-State-Systems-Manager/1.1 (OpenFEMA read-only)"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError("OpenFEMA HTTP response is not 200")
        geturl = getattr(response, "geturl", None)
        if callable(geturl) and geturl() != url:
            raise ValueError("Redirected OpenFEMA URL rejected")
        raw = response.read(_MAX_RESPONSE_BYTES + 1)
    if not isinstance(raw, bytes) or not raw or len(raw) > _MAX_RESPONSE_BYTES:
        raise ValueError("Empty or oversized OpenFEMA page")
    return raw


def query_dataset(
    dataset: str,
    odata_filter: str = "",
    select: str = "",
    orderby: str = "",
    top: int = 100,
    timeout: float = _REQUEST_TIMEOUT_S,
    *,
    max_pages: int = 20,
    max_records: int = 20000,
) -> dict:
    """Get paged records and raw-byte hashes, explicitly marking incomplete data.

    OBSERVED means complete bounded administrative retrieval, not physical
    observation. PARTIAL must not be treated as complete. An empty failure
    returns UNAVAILABLE and omits records.
    """
    try:
        _validate(dataset, odata_filter, select, orderby, top, timeout,
                  max_pages, max_records)
    except (ValueError, TypeError) as exc:
        return {"status": "UNAVAILABLE", "dataset": dataset,
                "reason": str(exc), "complete": False}

    version, deprecated = DATASET_VERSIONS[dataset]
    rows, receipts = [], []
    complete = False
    problem = None
    for index in range(max_pages):
        if len(rows) >= max_records:
            problem = "MAX_RECORDS_REACHED"
            break
        page_top = min(top, max_records - len(rows))
        url = _request_url(dataset, version, odata_filter, select, orderby,
                           page_top, len(rows))
        try:
            raw = _fetch_page(url, timeout)
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("OpenFEMA response must be a JSON object")
            batch = payload.get(dataset)
            if not isinstance(batch, list) or any(not isinstance(x, dict) for x in batch):
                raise ValueError("OpenFEMA collection missing or malformed")
            if len(batch) > page_top:
                raise ValueError("OpenFEMA page exceeds $top")
        except Exception as exc:
            problem = "OpenFEMA page failure: " + type(exc).__name__
            break
        receipts.append({"url": url, "sha256": hashlib.sha256(raw).hexdigest(),
                         "bytes": len(raw), "record_count": len(batch),
                         "page_index": index})
        rows.extend(batch)
        if len(batch) < page_top:
            complete = True
            break
    else:
        problem = "MAX_PAGES_REACHED"

    if not complete and problem is None:
        problem = "MAX_RECORDS_REACHED"
    status = "OBSERVED" if complete else ("PARTIAL" if rows else "UNAVAILABLE")
    result = {
        "status": status, "dataset": dataset, "apiVersion": version,
        "deprecatedDataset": deprecated, "record_count": len(rows),
        "page_count": len(receipts), "page_receipts": receipts,
        "complete": complete, "retrieved_at": utc_now_iso(),
        "api": f"{OPENFEMA_ROOT}/v{version}",
        "sourceAuthority": "FEMA OpenFEMA administrative data; not NFHL geometry",
        "pagination": "locally constructed $top/$skip; source order can change between pages",
    }
    if rows or complete:
        result["records"] = rows
    if not complete:
        result["reason"] = problem
    return result


def posey_county_declarations() -> dict:
    """Federal disaster declarations designating Posey County, IN."""
    return query_dataset(
        "DisasterDeclarationsSummaries",
        odata_filter="state eq 'IN' and fipsCountyCode eq '129'",
        select=(
            "disasterNumber,declarationDate,incidentType,declarationTitle,"
            "designatedArea,ihProgramDeclared,iaProgramDeclared,"
            "paProgramDeclared,hmProgramDeclared"),
        orderby="declarationDate desc", top=100,
    )


def nfip_policies_posey_county(top: int = 100) -> dict:
    """Legacy v2 query (deprecated); do NOT join policies to owners/parcels."""
    return query_dataset(
        "FimaNfipPolicies", odata_filter="countyCode eq '18129'",
        select=(
            "nfipCommunityNumberCurrent,nfipCommunityName,ratedFloodZone,"
            "occupancyType,policyCount,policyEffectiveDate"),
        top=top,
    )


if __name__ == "__main__":
    import sys
    result = posey_county_declarations() if (
        len(sys.argv) <= 1 or sys.argv[1] == "declarations"
    ) else nfip_policies_posey_county()
    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get("complete") else 1)
