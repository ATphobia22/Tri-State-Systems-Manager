"""Fail-closed regulatory screening for TSM.

This module is a screening aid, not a regulatory determination. It records the
source-backed rule thresholds verified on 2026-09-18 and requires human review
before any governance effect.

Important:
- Indiana DNR describes a 0.15 ft cumulative surcharge criterion under 312 IAC
  10, while FEMA/local floodplain administration may require a 0.00 ft no-rise
  certification or CLOMR. These are separate controls.
- Illinois Part 3700 defines the floodway around a 0.1 ft maximum stage increase,
  with additional context-specific standards elsewhere in the Part.
- Kentucky 401 KAR 4:060 defines "no impact" as no increase for ordinary
  floodway encroachments, while its regulatory-floodway boundary definition
  permits up to a 1.0 ft rise. The engine does not collapse those concepts.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Final, Literal

Jurisdiction = Literal["IN", "IL", "KY"]

RULE_SOURCES: Final[dict[str, dict[str, str]]] = {
    "IN": {
        "citation": "IC 14-28-1; 312 IAC 10",
        "source_uri": "https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/no-rise/",
        "rule": "Indiana DNR uses a 0.15 ft cumulative surcharge criterion; FEMA floodway projects may separately require 0.00 ft no-rise certification or CLOMR.",
    },
    "IL": {
        "citation": "17 Ill. Adm. Code Part 3700",
        "source_uri": "https://www.ilga.gov/agencies/JCAR/EntirePart?titlepart=01703700",
        "rule": "Illinois defines the regulatory floodway using no more than a 0.1 ft increase in stage; other sections contain context-specific limits.",
    },
    "KY": {
        "citation": "401 KAR 4:060",
        "source_uri": "https://apps.legislature.ky.gov/law/kar/titles/401/004/060/",
        "rule": "Kentucky generally requires no-impact certification for floodway encroachments; its floodway-boundary definition uses a separate 1.0 ft maximum rise criterion.",
    },
}

ENGINE_VERSION: Final = "Archimedes_v36_screening"


class ArchimedesEngine:
    """Source-bound regulatory screening engine with mandatory human governance."""

    def __init__(self, node_id: str = "community-engineering") -> None:
        self.node_id = node_id

    @staticmethod
    def _jurisdiction(value: str) -> Jurisdiction:
        normalized = value.strip().upper()
        aliases = {"INDIANA": "IN", "ILLINOIS": "IL", "KENTUCKY": "KY"}
        normalized = aliases.get(normalized, normalized)
        if normalized not in {"IN", "IL", "KY"}:
            raise ValueError("Unsupported jurisdiction; expected IN, IL, or KY.")
        return normalized  # type: ignore[return-value]

    def evaluate_jurisdiction_compliance(
        self,
        jurisdiction: str,
        stage_ft_navd88: float,
        bfe_ft_navd88: float,
        *,
        floodway_delta_ft: float | None = None,
        floodway_context: Literal["FEMA", "STATE", "UNKNOWN"] = "UNKNOWN",
        authoritative_model_id: str | None = None,
        source_evidence_hash: str | None = None,
    ) -> dict[str, Any]:
        """Perform a source-bound screening.

        The result intentionally uses screening_status rather than a legal
        compliant boolean. A numerical screen cannot establish permit
        eligibility or regulatory compliance.
        """
        if not all(
            isinstance(value, (int, float)) and value == value
            for value in (stage_ft_navd88, bfe_ft_navd88)
        ):
            raise ValueError("stage_ft_navd88 and bfe_ft_navd88 must be finite numbers.")
        if floodway_delta_ft is not None and (
            not isinstance(floodway_delta_ft, (int, float)) or floodway_delta_ft != floodway_delta_ft
        ):
            raise ValueError("floodway_delta_ft must be finite when supplied.")

        jurisdiction_code = self._jurisdiction(jurisdiction)
        evaluated_at = datetime.now(timezone.utc).isoformat()
        reasons: list[str] = []
        flags: list[str] = []

        if not authoritative_model_id:
            return {
                "engine": ENGINE_VERSION,
                "status": "NOT_EVALUATED",
                "screening_status": "REQUIRES_AUTHORITATIVE_MODEL",
                "jurisdiction": jurisdiction_code,
                "reasons": ["FAIL_CLOSED: authoritative hydraulic model identifier is required."],
                "evaluated_at": evaluated_at,
                "source_rule": RULE_SOURCES[jurisdiction_code],
            }

        if source_evidence_hash is not None and (
            len(source_evidence_hash) != 64
            or any(ch not in "0123456789abcdefABCDEF" for ch in source_evidence_hash)
        ):
            raise ValueError("source_evidence_hash must be a 64-character hexadecimal SHA-256 value.")

        delta = floodway_delta_ft
        if delta is not None:
            if jurisdiction_code == "IN":
                if delta > 0.15:
                    flags.append("STATE_THRESHOLD_EXCEEDED")
                    reasons.append(f"Indiana DNR screening threshold exceeded: surcharge {delta:.3f} ft > 0.150 ft.")
                if floodway_context == "FEMA" and delta > 0.0:
                    flags.append("FEMA_NO_RISE_REVIEW_REQUIRED")
                    reasons.append("FEMA floodway context requires separate no-rise/CLOMR review; this screen does not certify it.")
            elif jurisdiction_code == "IL":
                if delta > 0.10:
                    flags.append("ILLINOIS_0_1_FT_THRESHOLD_EXCEEDED")
                    reasons.append(f"Illinois Part 3700 screening threshold exceeded: stage rise {delta:.3f} ft > 0.100 ft.")
            elif jurisdiction_code == "KY":
                if delta > 0.0:
                    flags.append("KENTUCKY_NO_IMPACT_NOT_MET")
                    reasons.append(f"Kentucky no-impact screen not met: modeled rise {delta:.3f} ft > 0.000 ft.")

        if stage_ft_navd88 > bfe_ft_navd88:
            flags.append("STAGE_ABOVE_BFE")
            reasons.append(
                f"Stage {stage_ft_navd88:.3f} ft exceeds supplied BFE {bfe_ft_navd88:.3f} ft; "
                "this is an engineering screening observation, not a permit determination."
            )

        screening_status = "SCREENED_NO_TRIGGER" if not flags else "SCREENED_WITH_TRIGGERS"
        return {
            "engine": ENGINE_VERSION,
            "status": "EVALUATED",
            "screening_status": screening_status,
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
            "authoritative_model_id": authoritative_model_id,
            "source_evidence_hash": source_evidence_hash,
            "evaluated_at": evaluated_at,
            "source_rule": RULE_SOURCES[jurisdiction_code],
        }

    def generate_proof_manifest(
        self,
        evaluation_result: dict[str, Any],
        *,
        reviewer_identity: str | None = None,
        review_reason: str | None = None,
    ) -> dict[str, Any]:
        """Create an integrity manifest; only human review can authorize governance."""
        if evaluation_result.get("engine") != ENGINE_VERSION:
            raise ValueError("Unsupported evaluation engine version.")
        signed = bool(reviewer_identity and reviewer_identity.strip() and review_reason and review_reason.strip())
        now = datetime.now(timezone.utc).isoformat()

        manifest: dict[str, Any] = {
            "manifest_type": "TSM_ARCHIMEDES_SCREENING_PROOF",
            "engine_version": ENGINE_VERSION,
            "node_id": self.node_id,
            "governance_status": "human_authorized" if signed else "human_review_required",
            "human_review_status": "signed" if signed else "unsigned",
            "reviewer_identity": reviewer_identity.strip() if signed else None,
            "review_reason": review_reason.strip() if signed else None,
            "reviewed_at": now if signed else None,
            "evaluation_body": evaluation_result,
            "disclaimer": (
                "Technology informs people; it does not silently govern people. "
                "This artifact is screening evidence, not a regulatory determination."
            ),
        }

        canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        manifest["proof_hash_sha256"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return manifest
