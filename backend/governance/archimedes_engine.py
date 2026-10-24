"""Fail-closed, source-bound regulatory screening for TSM Plane 3.

This module is advisory only. It does not run hydraulic solvers, issue permits,
or determine legal compliance. Thresholds are screening criteria mapped to the
cited rules; the applicable jurisdiction, permit pathway, mapped floodway,
local ordinance, exceptions, and current source revision require human review.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import math
from datetime import datetime, timezone
from typing import Any, Final, Literal

Jurisdiction = Literal["IN", "IL", "KY"]
SolverStatus = Literal["SUCCESS", "FAILED", "MISSING", "STALE", "UNKNOWN"]
InputFreshness = Literal["FRESH", "STALE", "MISSING", "UNKNOWN"]
FloodwayContext = Literal[
    "FEMA", "STATE", "ILLINOIS_URBAN", "ILLINOIS_RURAL",
    "FLOODWAY_DELINEATION", "UNKNOWN",
]

RULE_SOURCES: Final[dict[str, dict[str, str]]] = {
    "IN": {
        "citation": "IC 14-28-1; 312 IAC 10-2-3",
        "source_uri": "https://iar.iga.in.gov/code/current/312/10",
        "rule": (
            "312 IAC 10-2-3 defines an increase of at least 0.15 ft as adversely "
            "affecting floodway efficiency, subject to listed exceptions. FEMA "
            "floodway no-rise review is a separate control."
        ),
        "verified_on": "2026-10-24",
    },
    "IL": {
        "citation": "17 Ill. Adm. Code Part 3700, Sections 3700.20 and 3700.60",
        "source_uri": "https://www.ilga.gov/agencies/JCAR/EntirePart?titlepart=01703700",
        "rule": (
            "Section 3700.20 defines floodway using a 0.1 ft stage increase "
            "criterion. Section 3700.60 has context-dependent standards: urban "
            "profile increase no more than 0.1 ft, rural no more than 0.5 ft, "
            "or increases contained by channel banks/easements, subject to rule details."
        ),
        "verified_on": "2026-10-24",
    },
    "KY": {
        "citation": "401 KAR 4:060, Sections 1 and 4-5",
        "source_uri": "https://apps.legislature.ky.gov/law/kar/titles/401/004/060/",
        "rule": (
            "The no-impact definition for encroachments prohibits increase in "
            "base flood elevation, floodwater elevations, and floodway width. "
            "The separate regulatory-floodway boundary definition permits up "
            "to a 1.0 ft rise; do not conflate the two."
        ),
        "verified_on": "2026-10-24",
    },
}

ENGINE_VERSION: Final = "Archimedes_v37_fail_closed"
CANONICALIZATION_PROFILE: Final = "python-json-sortkeys-compact-utf8-v1"
PROOF_MANIFEST_TYPE: Final = "TSM_ARCHIMEDES_SCREENING_PROOF_V1"
HUMAN_AUTHORITY_DISCLAIMER: Final = (
    "Technology informs people; it does not silently govern people. "
    "This artifact is screening evidence, not a regulatory determination. "
    "A digest proves content integrity only; it does not prove authorship, "
    "professional approval, model validity, or legal admissibility."
)


def _is_finite_number(value: object) -> bool:
    """Reject booleans and non-finite numbers at engineering boundaries."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _canonical_json(value: Any) -> bytes:
    """Serialize the documented Python canonicalization profile for SHA-256.

    This profile is deterministic for this Python implementation. It is not
    claimed to be RFC 8785/JCS and must not be assumed byte-compatible across
    arbitrary languages until a conforming JCS implementation is adopted.
    """
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def _sha256_json(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value)).hexdigest()


class ArchimedesEngine:
    """Read-only Plane 3 constraint evaluator with mandatory human review."""

    def __init__(self, node_id: str = "community-engineering") -> None:
        if not isinstance(node_id, str) or not node_id.strip():
            raise ValueError("node_id must be a non-empty string.")
        self.node_id = node_id.strip()

    @staticmethod
    def _jurisdiction(value: str) -> Jurisdiction:
        if not isinstance(value, str):
            raise ValueError("jurisdiction must be a string.")
        normalized = value.strip().upper()
        aliases = {"INDIANA": "IN", "ILLINOIS": "IL", "KENTUCKY": "KY"}
        normalized = aliases.get(normalized, normalized)
        if normalized not in {"IN", "IL", "KY"}:
            raise ValueError("Unsupported jurisdiction; expected IN, IL, or KY.")
        return normalized  # type: ignore[return-value]

    @staticmethod
    def _not_evaluated(
        jurisdiction: Jurisdiction,
        reasons: list[str],
        *,
        authoritative_model_id: str | None,
        source_evidence_hash: str | None,
        solver_status: str,
        input_freshness: str,
    ) -> dict[str, Any]:
        return {
            "engine": ENGINE_VERSION,
            "status": "NOT_EVALUATED",
            "screening_status": "NOT_EVALUATED",
            "jurisdiction": jurisdiction,
            "regulatory_determination": None,
            "human_review_required": True,
            "reasons": reasons,
            "flags": ["FAIL_CLOSED"],
            "clearance_metrics": None,
            "authoritative_model_id": authoritative_model_id,
            "source_evidence_hash": source_evidence_hash,
            "solver_status": solver_status,
            "input_freshness": input_freshness,
            "source_rule": RULE_SOURCES[jurisdiction],
            "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z"),
        }

    def evaluate_jurisdiction_compliance(
        self,
        jurisdiction: str,
        stage_ft_navd88: float | None,
        bfe_ft_navd88: float | None,
        *,
        floodway_delta_ft: float | None = None,
        floodway_context: FloodwayContext = "UNKNOWN",
        authoritative_model_id: str | None = None,
        source_evidence_hash: str | None = None,
        solver_status: SolverStatus = "UNKNOWN",
        input_freshness: InputFreshness = "UNKNOWN",
    ) -> dict[str, Any]:
        """Evaluate source-bound screening rules; fail closed on missing evidence.

        A returned SCREENED_* value is not a compliance determination. Inputs
        must identify the actual solver run, evidence digest, successful solver
        status, freshness, and applicable floodway context.
        """
        jurisdiction_code = self._jurisdiction(jurisdiction)
        valid_solver_status = {"SUCCESS", "FAILED", "MISSING", "STALE", "UNKNOWN"}
        valid_freshness = {"FRESH", "STALE", "MISSING", "UNKNOWN"}
        valid_context = {
            "FEMA", "STATE", "ILLINOIS_URBAN", "ILLINOIS_RURAL",
            "FLOODWAY_DELINEATION", "UNKNOWN",
        }
        if solver_status not in valid_solver_status:
            raise ValueError("Unsupported solver_status.")
        if input_freshness not in valid_freshness:
            raise ValueError("Unsupported input_freshness.")
        if floodway_context not in valid_context:
            raise ValueError("Unsupported floodway_context.")
        if stage_ft_navd88 is not None and not _is_finite_number(stage_ft_navd88):
            raise ValueError("stage_ft_navd88 must be a finite number or None.")
        if bfe_ft_navd88 is not None and not _is_finite_number(bfe_ft_navd88):
            raise ValueError("bfe_ft_navd88 must be a finite number or None.")
        if floodway_delta_ft is not None and not _is_finite_number(floodway_delta_ft):
            raise ValueError("floodway_delta_ft must be a finite number or None.")
        if source_evidence_hash is not None and (
            len(source_evidence_hash) != 64
            or any(ch not in "0123456789abcdefABCDEF" for ch in source_evidence_hash)
        ):
            raise ValueError("source_evidence_hash must be a 64-character SHA-256 hex digest.")

        blocked: list[str] = []
        if not authoritative_model_id or not authoritative_model_id.strip():
            blocked.append("AUTHORITATIVE_MODEL_NOT_ATTACHED")
        if source_evidence_hash is None:
            blocked.append("SOURCE_EVIDENCE_HASH_MISSING")
        if solver_status != "SUCCESS":
            blocked.append(f"SOLVER_STATUS_{solver_status}")
        if input_freshness != "FRESH":
            blocked.append(f"INPUT_FRESHNESS_{input_freshness}")
        if stage_ft_navd88 is None or bfe_ft_navd88 is None:
            blocked.append("REQUIRED_ELEVATION_INPUT_MISSING")
        if floodway_delta_ft is not None and floodway_context == "UNKNOWN":
            blocked.append("FLOODWAY_CONTEXT_UNKNOWN")
        if jurisdiction_code == "IL" and floodway_delta_ft is not None and floodway_context not in {
            "ILLINOIS_URBAN", "ILLINOIS_RURAL", "FLOODWAY_DELINEATION"
        }:
            blocked.append("ILLINOIS_RULE_CONTEXT_NOT_RESOLVED")
        if blocked:
            return self._not_evaluated(
                jurisdiction_code,
                blocked,
                authoritative_model_id=authoritative_model_id,
                source_evidence_hash=source_evidence_hash,
                solver_status=solver_status,
                input_freshness=input_freshness,
            )

        assert stage_ft_navd88 is not None and bfe_ft_navd88 is not None
        reasons: list[str] = []
        flags: list[str] = []
        delta = floodway_delta_ft

        if delta is not None:
            if jurisdiction_code == "IN":
                if delta >= 0.15:
                    flags.append("INDIANA_0_15_FT_CRITERION_REACHED")
                    reasons.append(
                        "312 IAC 10-2-3 screening criterion reached: increase is at least 0.150 ft; "
                        "check statutory exceptions and permit pathway."
                    )
                if floodway_context == "FEMA" and delta > 0.0:
                    flags.append("FEMA_NO_RISE_REVIEW_REQUIRED")
                    reasons.append(
                        "Positive rise in FEMA floodway context requires separate no-rise/CLOMR review; "
                        "this engine does not certify it."
                    )
            elif jurisdiction_code == "IL":
                threshold = 0.1 if floodway_context in {"ILLINOIS_URBAN", "FLOODWAY_DELINEATION"} else 0.5
                if delta > threshold:
                    flags.append("ILLINOIS_CONTEXT_THRESHOLD_EXCEEDED")
                    reasons.append(
                        f"Illinois {floodway_context} screening threshold exceeded: "
                        f"rise {delta:.3f} ft > {threshold:.3f} ft; check Section 3700.60 conditions."
                    )
            elif jurisdiction_code == "KY" and delta > 0.0:
                flags.append("KENTUCKY_NO_IMPACT_NOT_MET")
                reasons.append(
                    "Positive modeled rise does not meet the 401 KAR 4:060 no-impact screening "
                    "criterion for an encroachment; confirm applicability with the regulator."
                )

        if stage_ft_navd88 > bfe_ft_navd88:
            flags.append("STAGE_ABOVE_BFE")
            reasons.append(
                f"Stage {stage_ft_navd88:.3f} ft exceeds supplied BFE {bfe_ft_navd88:.3f} ft; "
                "this is an engineering screening observation, not a permit determination."
            )

        return {
            "engine": ENGINE_VERSION,
            "status": "EVALUATED",
            "screening_status": "SCREENED_NO_TRIGGER" if not flags else "SCREENED_WITH_TRIGGERS",
            "jurisdiction": jurisdiction_code,
            "regulatory_determination": None,
            "human_review_required": True,
            "reasons": reasons,
            "flags": flags,
            "clearance_metrics": {
                "stage_ft_navd88": round(stage_ft_navd88, 3),
                "bfe_ft_navd88": round(bfe_ft_navd88, 3),
                "stage_minus_bfe_ft": round(stage_ft_navd88 - bfe_ft_navd88, 3),
                "floodway_surcharge_delta_ft": round(delta, 3) if delta is not None else None,
            },
            "authoritative_model_id": authoritative_model_id.strip() if authoritative_model_id else None,
            "source_evidence_hash": source_evidence_hash.lower() if source_evidence_hash else None,
            "solver_status": solver_status,
            "input_freshness": input_freshness,
            "floodway_context": floodway_context,
            "source_rule": RULE_SOURCES[jurisdiction_code],
            "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z"),
        }

    def generate_proof_manifest(
        self,
        evaluation_result: dict[str, Any],
        *,
        reviewer_identity: str | None = None,
        review_reason: str | None = None,
    ) -> dict[str, Any]:
        """Create a deterministic integrity manifest; never infer a signature.

        Reviewer identity/reason are audit metadata only. They do not authorize
        the evaluation. A future approval flow must verify a real digital
        signature against an explicit trust policy before changing governance.
        """
        if evaluation_result.get("engine") != ENGINE_VERSION:
            raise ValueError("Unsupported evaluation engine version.")
        reviewer = reviewer_identity.strip() if reviewer_identity and reviewer_identity.strip() else None
        reason = review_reason.strip() if review_reason and review_reason.strip() else None
        if (reviewer is None) != (reason is None):
            raise ValueError("reviewer_identity and review_reason must be supplied together.")

        manifest: dict[str, Any] = {
            "manifest_type": PROOF_MANIFEST_TYPE,
            "engine_version": ENGINE_VERSION,
            "canonicalization_profile": CANONICALIZATION_PROFILE,
            "hash_algorithm": "SHA-256",
            "node_id": self.node_id,
            "governance_status": "human_review_required",
            "human_review_status": "review_metadata_recorded" if reviewer else "unsigned",
            "reviewer_identity": reviewer,
            "review_reason": reason,
            "evaluation_body": evaluation_result,
            "disclaimer": HUMAN_AUTHORITY_DISCLAIMER,
        }
        manifest["proof_hash_sha256"] = _sha256_json(manifest)
        return manifest

    @staticmethod
    def verify_proof_manifest(manifest: dict[str, Any]) -> bool:
        """Verify manifest integrity; this does not authenticate the reviewer."""
        if not isinstance(manifest, dict):
            return False
        supplied_hash = manifest.get("proof_hash_sha256")
        if not isinstance(supplied_hash, str) or len(supplied_hash) != 64:
            return False
        if any(ch not in "0123456789abcdef" for ch in supplied_hash):
            return False
        payload = {key: value for key, value in manifest.items() if key != "proof_hash_sha256"}
        try:
            expected_hash = _sha256_json(payload)
        except (TypeError, ValueError):
            return False
        return hmac.compare_digest(expected_hash, supplied_hash)
