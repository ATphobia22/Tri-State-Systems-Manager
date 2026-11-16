#!/usr/bin/env python3
"""Offline authority/rights gate for the IGWS historical geological bibliography.

No network retrieval, map raster ingestion, spatial intersection, GeMS schema validation,
professional review, or certification is performed. Python standard library only.
"""
import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
CATALOG = "data/fabrics/geological/gray-historical-publications-2026-11-16.json"
RIGHTS = {"CONFLICTING_NOTICES", "NONCOMMERCIAL_REPORTED", "NOT_VERIFIED"}
COVERAGE = {"HISTORICAL_STATEWIDE_CONTEXT", "STATEWIDE_REGIONAL_CONTEXT", "OUTSIDE_CORE_AOI", "FOOTPRINT_NOT_GEOREFERENCED"}

def require(ok, why):
    if not ok:
        raise ValueError(why)

def verify_catalog(doc):
    require(isinstance(doc, dict) and doc.get("schema") == "tsm-igws-historical-geologic-publications", "Invalid historical geology catalog schema")
    require(doc.get("version") == "1.0.0" and doc.get("reviewedOn") == "2026-11-16", "Unreviewed catalog version/date")
    p = doc.get("authorityPolicy")
    require(isinstance(p, dict), "Missing authority policy")
    for name in ("automaticRegulatoryApproval", "automaticProfessionalCertification", "historicalMapsMayEstablishSiteObservations", "originalMapImagesBundled"):
        require(p.get(name) is False, "Invalid authority policy: " + name)
    records = doc.get("publications")
    require(isinstance(records, list) and len(records) >= 6, "Missing historical publications")
    seen = set()
    for r in records:
        require(isinstance(r, dict), "Publication must be an object")
        key = r.get("id")
        require(isinstance(key, str) and key.startswith("IGWS-") and key not in seen, "Publication identity is absent or repeated")
        seen.add(key)
        require(isinstance(r.get("title"), str) and len(r["title"]) > 15, key + ": title")
        require(isinstance(r.get("authors"), list) and r["authors"] and all(isinstance(a, str) and a.strip() for a in r["authors"]), key + ": authors")
        require(type(r.get("publishedYear")) is int and 1800 <= r["publishedYear"] <= 2026, key + ": publication year")
        require(isinstance(r.get("series"), str) and bool(r["series"]) and isinstance(r.get("seriesNumber"), str), key + ": series")
        scale = r.get("mapScaleDenominator")
        require(scale is None or (type(scale) is int and 1000 <= scale <= 1000000), key + ": invalid map scale")
        u = urlparse(r.get("catalogUrl", ""))
        require(u.scheme == "https" and u.hostname == "scholarworks.iu.edu" and not u.username and not u.password, key + ": non-official catalog URL")
        require(r.get("metadataReviewStatus") == "CATALOG_METADATA_VERIFIED", key + ": unreviewed metadata")
        require(r.get("rightsStatus") in RIGHTS and bool(r.get("rightsNote")), key + ": rights must be explicit")
        require(r.get("poseyCoverageStatus") in COVERAGE and bool(r.get("scope")), key + ": coverage")
        for field in ("georeferencedFootprintVerified", "publicMapRedistributionApproved", "siteGeotechnicalObservation"):
            require(r.get(field) is False, key + ": cannot self-certify " + field)
        require(r.get("sourceArtifactSha256") is None, key + ": no map bytes acquired by catalog")
    require("IGWS-MM48-1987" in seen and "IGWS-MM49-1989" in seen and "IGWS-RGM03-1970" in seen, "Missing key regional geology products")
    return {"status": "BIBLIOGRAPHIC_METADATA_CHECKED_ONLY", "publicationCount": len(records),
            "mapImagesPackaged": False, "siteSurveyEvidence": False, "geologicMapSchemaConformant": None}

def evaluate_request(doc, publication_id, use):
    record = next((r for r in doc["publications"] if r["id"] == publication_id), None)
    require(record is not None, "Unknown publication ID")
    require(use in {"BIBLIOGRAPHY", "REGIONAL_CONTEXT", "SITE_ENGINEERING", "REGULATORY"}, "Invalid intended use")
    return {"publicationId": publication_id, "intendedUse": use,
            "citationDisplayPermitted": True, "mapPixelsRedistributionApproved": False,
            "siteEngineeringEvidenceAccepted": False, "regulatoryEvidenceAccepted": False,
            "status": "REFERENCE_ONLY_REVIEW_REQUIRED" if use != "BIBLIOGRAPHY" else "CATALOG_CITATION_ONLY",
            "limitation": "Published mapping scale and source citation do not establish surveyed subsurface truth, a validated footprint, or license clearance."}

AUTHORITY_INDEX = "data/standards/tsm-professional-geologist-authorities-2026-11-16.json"
BOARD_HOST = {"IN": "igws.iu.edu", "IL": "idfpr.illinois.gov", "KY": "bpg.ky.gov"}
LAW_HOST = {"IN": "iga.in.gov", "IL": "www.ilga.gov", "KY": "apps.legislature.ky.gov"}

def verify_licensing_authorities(doc):
    require(isinstance(doc, dict) and doc.get("schema") == "tsm-geologist-licensing-authority-index", "Invalid geology board index schema")
    exam = doc.get("asbog") or {}
    require(exam.get("issuesLicenses") is False and exam.get("providesExaminations") is True, "ASBOG must not be treated as license issuer")
    require(urlparse(exam.get("officialUrl", "")).hostname == "www.asbog.org", "ASBOG URL not grounded")
    entries = doc.get("authorities")
    require(isinstance(entries, list) and len(entries) == 3, "Exactly three state authorities required")
    states = set()
    for row in entries:
        state = row.get("state")
        require(state in BOARD_HOST and state not in states, "Missing/duplicate state board")
        states.add(state)
        for field in ("licensingBoard", "lawCitation", "jurisdiction", "boardNote"):
            require(isinstance(row.get(field), str) and row[field].strip(), state + ": missing " + field)
        for field, expected in (("boardReference", BOARD_HOST[state]), ("lawUrl", LAW_HOST[state])):
            parsed = urlparse(row.get(field, ""))
            require(parsed.scheme == "https" and parsed.hostname == expected and not parsed.username and not parsed.password, state + ": incorrect " + field)
        require(row.get("verificationStatus") == "AUTHORITY_DIRECTORY_ONLY", state + ": cannot assert professional licensure")
        require(row.get("liveLicenseVerified") is False and row.get("tsmMayIssueLicense") is False, state + ": cannot self-issue/verify license")
    return {"stateBoardsListed": 3, "licenseCredentialsVerified": False,
            "examProviderIsLicenseIssuer": False, "status": "STATE_AUTHORITY_REFERENCE_ONLY"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=ROOT / CATALOG)
    parser.add_argument("--publication-id")
    parser.add_argument("--use", choices=["BIBLIOGRAPHY", "REGIONAL_CONTEXT", "SITE_ENGINEERING", "REGULATORY"], default="BIBLIOGRAPHY")
    args = parser.parse_args(argv)
    try:
        doc = json.loads(args.catalog.read_text(encoding="utf-8"))
        result = verify_catalog(doc)
        authority_path = args.catalog.parent.parent.parent / "standards/tsm-professional-geologist-authorities-2026-11-16.json"
        if not authority_path.is_file():
            authority_path = ROOT / AUTHORITY_INDEX
        result.update(verify_licensing_authorities(json.loads(authority_path.read_text(encoding="utf-8"))))
        if args.publication_id:
            result["request"] = evaluate_request(doc, args.publication_id, args.use)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as e:
        print(json.dumps({"status": "INVALID", "reason": str(e)}), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
