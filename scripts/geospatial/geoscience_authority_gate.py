#!/usr/bin/env python3
"""Offline, deterministic geoscience source/standard and review-evidence gate.

This is a provenance and review-document *inventory* validator, not a GeMS
schema parser, 3DEP deliverable conformance audit, USGS FSP approval, state
license checker, or engineering/survey certification. No network or third-party
dependencies. Source editions are recorded, never retroactively replaced.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = "data/standards/geoscience-authority-profile-v1.json"
ROLES = {
    "AGENCY_POLICY", "PROGRAM_SPECIFICATION", "PROGRAM_SCHEMA",
    "FEDERAL_STANDARD", "FEDERAL_GUIDANCE", "ADVISORY_ONLY",
    "STATE_LICENSE_AUTHORITY", "EXAM_PROVIDER",
    "VOLUNTARY_CERTIFICATION", "THIRD_PARTY_CONSENSUS_STANDARD",
}
REQUIRED_IDS = {
    "USGS-FSP-502.3-2026", "USGS-FSP-502.7-2026",
    "USGS-FSP-502.8-2026", "USGS-3DEP-LBS-2025A", "USGS-GEMS-2020",
    "FGDC-GEOLOGIC-SYMBOLOGY-2006", "FGDC-METADATA-CSDGM-ISO",
    "FGDC-NGAC-ADVISORY", "IN-LPG-BOARD", "IL-LPG-IDFPR",
    "KY-PG-BOARD", "ASBOG-EXAM", "AIPG-CPG",
    "ASPRS-POSACC-2024-2V2",
}
SHA256 = re.compile(r"^[0-9a-f]{64}$")
EPSG = re.compile(r"^EPSG:[0-9]{3,6}$")
KINDS = {"LIDAR_COLLECTION", "GEOLOGIC_MAP", "SCIENTIFIC_DATA"}
LEVELS = {"CATALOG_ONLY", "SOURCE_BYTES_HASHED", "REVIEW_DOCUMENTS_PRESENT"}
REVIEW_ROLES = {"DATA_REVIEW", "METADATA_REVIEW", "SCIENTIFIC_PEER_REVIEW", "SCHEMA_VALIDATION", "PROFESSIONAL_LICENSE_LOOKUP"}


def require(value: object, reason: str) -> None:
    if not value:
        raise ValueError(reason)


def https_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password


def iso_date(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat() == value
    except ValueError:
        return False


def utc_timestamp(value: object) -> bool:
    if not isinstance(value, str) or not value.endswith("Z"):
        return False
    try:
        return datetime.fromisoformat(value[:-1] + "+00:00").utcoffset().total_seconds() == 0
    except (ValueError, TypeError, AttributeError):
        return False


def check_registry(root: Path = ROOT) -> dict:
    """Validate authority roles and return the indexed, source-backed references."""
    profile = json.loads((root / REGISTRY_PATH).read_text(encoding="utf-8"))
    require(profile.get("schema") == "tsm-geoscience-authority-profile", "registry schema mismatch")
    require(profile.get("version") == "1.0.0", "registry version mismatch")
    require(iso_date(profile.get("reviewedOn")), "registry reviewedOn must be a date")
    policy = profile.get("policy", {})
    for key in ("automaticScientificCertification", "automaticRegulatoryApproval", "automaticProfessionalLicensing"):
        require(policy.get(key) is False, f"policy {key} must be false")
    require(policy.get("undocumentedConformance") == "NOT_EVIDENCED", "unknown conformance must stay NOT_EVIDENCED")
    entries = profile.get("entries")
    require(isinstance(entries, list) and len(entries) >= len(REQUIRED_IDS), "authority registry incomplete")
    indexed = {}
    for idx, rec in enumerate(entries):
        require(isinstance(rec, dict), f"record {idx} must be an object")
        key = rec.get("id")
        require(isinstance(key, str) and key and key not in indexed, "authority ID missing or duplicate")
        require(rec.get("role") in ROLES, f"{key}: unknown role")
        require(https_url(rec.get("officialUrl")), f"{key}: HTTPS official URL required")
        require(all(isinstance(rec.get(f), str) and rec[f] for f in ("title", "issuer", "edition", "appliesTo", "note")),
                f"{key}: missing issuer/edition/scope")
        require(rec.get("issuedAt") is None or iso_date(rec["issuedAt"]), f"{key}: invalid issue date")
        indexed[key] = rec
    require(REQUIRED_IDS <= indexed.keys(), "missing required geoscience authorities")
    require(indexed["FGDC-NGAC-ADVISORY"]["role"] == "ADVISORY_ONLY", "NGAC cannot become a licensing authority")
    require(indexed["ASBOG-EXAM"]["role"] == "EXAM_PROVIDER", "ASBOG does not grant licenses")
    require(indexed["AIPG-CPG"]["role"] == "VOLUNTARY_CERTIFICATION", "AIPG is not a state license board")
    require(indexed["IN-LPG-BOARD"]["role"] == "STATE_LICENSE_AUTHORITY"
            and indexed["IL-LPG-IDFPR"]["role"] == "STATE_LICENSE_AUTHORITY"
            and indexed["KY-PG-BOARD"]["role"] == "STATE_LICENSE_AUTHORITY",
            "tri-state licensure authority role misclassified")
    require(indexed["USGS-3DEP-LBS-2025A"]["edition"] == "2025 rev. A", "latest pinned LBS reference changed")
    require(indexed["USGS-GEMS-2020"]["edition"] == "2020", "GeMS 2020 reference missing")
    return indexed


def hashed_local_file(root: Path, entry: object, context: str) -> dict:
    """Pin actual bytes inside root; reject path escapes, symlinks and fake digests."""
    require(isinstance(entry, dict), f"{context}: file/hash record required")
    path = entry.get("localPath")
    sha = entry.get("sha256")
    require(isinstance(path, str) and path and not Path(path).is_absolute(), f"{context}: relative path required")
    require(isinstance(sha, str) and SHA256.fullmatch(sha) is not None, f"{context}: lowercase SHA-256 required")
    base = root.resolve()
    local = (base / path).resolve()
    require(local.is_relative_to(base), f"{context}: escaped repository root")
    require(local.is_file() and not (base / path).is_symlink(), f"{context}: evidence file missing or symlink")
    with local.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    require(digest == sha, f"{context}: SHA-256 mismatch")
    return {"localPath": path, "sha256": digest, "sizeBytes": local.stat().st_size}


def check_manifest(manifest: dict, root: Path, references: dict) -> dict:
    """Inventory verified local bytes/review reports without promoting compliance."""
    require(isinstance(manifest, dict) and manifest.get("schema") == "tsm-geoscience-evidence-v1", "evidence schema mismatch")
    require(manifest.get("subjectType") in KINDS, "unknown subjectType")
    level = manifest.get("evidenceLevel")
    require(level in LEVELS, "unknown evidenceLevel")
    for false_claim in ("regulatoryApproval", "usgsBureauApproved", "professionalLicenseVerified", "gemsConformant", "lidarSpecificationCertified"):
        require(manifest.get(false_claim) is not True, f"{false_claim}: self-certification prohibited")
    source = manifest.get("source")
    require(isinstance(source, dict), "source metadata required")
    identifier = source.get("standardId")
    require(identifier in references, "unknown standardId")
    reference = references[identifier]
    expected_role = {"LIDAR_COLLECTION": "PROGRAM_SPECIFICATION", "GEOLOGIC_MAP": "PROGRAM_SCHEMA"}
    if manifest["subjectType"] in expected_role:
        require(reference["role"] == expected_role[manifest["subjectType"]], "inapplicable standard role for dataset type")
    else:
        require(reference["role"] in {"AGENCY_POLICY", "PROGRAM_SPECIFICATION", "PROGRAM_SCHEMA",
                                      "FEDERAL_STANDARD", "FEDERAL_GUIDANCE",
                                      "THIRD_PARTY_CONSENSUS_STANDARD"},
                "advisory, exam, voluntary credential or licensing board is not a scientific-data standard")
    for field in ("id", "issuer", "standardEdition", "coverage", "horizontalCrs", "verticalDatum", "units", "limitations"):
        require(isinstance(source.get(field), str) and source[field].strip(), f"source.{field} required")
    require(https_url(source.get("sourceUri")), "source.sourceUri must be HTTPS")
    require(source["horizontalCrs"] == "UNKNOWN" or EPSG.fullmatch(source["horizontalCrs"]),
            "source.horizontalCrs must be EPSG or UNKNOWN")
    require(source["units"] in ("m", "ftUS", "ft", "UNKNOWN"), "source.units must declare m/ftUS/ft/UNKNOWN")
    require(manifest.get("interpretive") in (True, False), "interpretive must be explicitly true/false")
    require(manifest.get("jurisdiction") in ("IN", "IL", "KY", "FEDERAL", "MULTI_STATE"), "jurisdiction required")
    require(manifest.get("automatedApproval") is False, "automatedApproval must be false")
    require(isinstance(manifest.get("reviewEvidence", []), list), "reviewEvidence must be a list")
    edition_matches = source["standardEdition"] == reference["edition"]
    files = []
    reviews = []
    if level != "CATALOG_ONLY":
        require(utc_timestamp(source.get("retrievedAtUtc")), "actual retrieval time required")
        files.append(hashed_local_file(root, source.get("sourceArtifact"), "source"))
    if level == "REVIEW_DOCUMENTS_PRESENT":
        for idx, review in enumerate(manifest["reviewEvidence"]):
            require(isinstance(review, dict) and review.get("kind") in REVIEW_ROLES,
                    f"review {idx}: invalid review kind")
            require(isinstance(review.get("reviewerRef"), str) and review["reviewerRef"].strip(),
                    f"review {idx}: reviewer reference required")
            require(utc_timestamp(review.get("reviewedAtUtc")), f"review {idx}: UTC review time required")
            file = hashed_local_file(root, review.get("artifact"), f"review {idx}")
            reviews.append({"kind": review["kind"], "reviewerRef": review["reviewerRef"], "artifact": file})
        kinds = {r["kind"] for r in reviews}
        require({"DATA_REVIEW", "METADATA_REVIEW"} <= kinds, "review documentation requires data and metadata review")
        if manifest["interpretive"]:
            peers = {r["reviewerRef"] for r in reviews if r["kind"] == "SCIENTIFIC_PEER_REVIEW"}
            require(len(peers) >= 2, "interpretive peer review needs at least two separately documented reviewers")
            peer_files = {r["artifact"]["sha256"] for r in reviews if r["kind"] == "SCIENTIFIC_PEER_REVIEW"}
            require(len(peer_files) >= 2, "interpretive peer review needs separately hashed review records")
    else:
        require(not manifest["reviewEvidence"], "reviewEvidence requires REVIEW_DOCUMENTS_PRESENT level")
    # A source's collection-era edition is not silently overwritten by today's latest spec.
    # A digest authenticates only the bytes supplied here; reviewer qualifications,
    # official issue/authorship, and authority of a government release are not verified.
    state = (
        "DISCOVERY_REFERENCE_ONLY" if level == "CATALOG_ONLY"
        else "SOURCE_BYTES_HASHED_NOT_SCIENCE_VALIDATED" if level == "SOURCE_BYTES_HASHED"
        else "REVIEW_DOCUMENTS_HASHED_NOT_AUTHENTICATED"
    )
    return {
        "schema": "tsm-geoscience-evidence-assessment-v1",
        "datasetId": source["id"],
        "sourceStandardId": identifier,
        "documentedSourceEdition": source["standardEdition"],
        "referenceEdition": reference["edition"],
        "editionMatchesReference": edition_matches,
        "editionStatus": "MATCH" if edition_matches else "HISTORICAL_OR_OTHER_EDITION_REQUIRES_VALIDATION",
        "evidenceLevel": level,
        "status": state,
        "sourceBytesVerified": bool(files),
        "hashedSources": files,
        "hashedReviews": reviews,
        "independentSurveyEstablished": False,
        "schemaConformanceEstablished": False,
        "scientificCertification": None,
        "professionalLicenseVerified": False,
        "usgsBureauApproved": False,
        "regulatoryApproval": False,
        "limitations": "File digests and local review records do not validate scientific, GeMS/LBS, professional or agency conformance.",
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root for registry and local evidence")
    parser.add_argument("--manifest", type=Path, help="Optional local candidate evidence JSON, never live agency verification")
    args = parser.parse_args(argv)
    try:
        registry = check_registry(args.root)
        if args.manifest:
            item = json.loads(args.manifest.read_text(encoding="utf-8"))
            result = check_manifest(item, args.root, registry)
        else:
            result = {
                "schema": "tsm-geoscience-authority-profile-check-v1",
                "registeredAuthorities": len(registry),
                "referenceStatus": "OFFICIAL_REFERENCE_METADATA_CHECKED",
                "siteEvidenceEstablished": False,
                "usgsBureauApproved": False,
                "professionalLicenseVerified": False,
                "regulatoryApproval": False,
            }
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "INVALID_EVIDENCE", "error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
