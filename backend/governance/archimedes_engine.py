"""Resilient regulatory screening for TSM.

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
import math
from datetime import datetime, timezone
from typing import Any, Final, Literal

Jurisdiction = Literal["IN", "IL", "KY"]

RULE_SOURCES: Final[dict[str, dict[str, str]]] = {
    "IN": {
        "citation": "IC 14-28-1; 312 IAC 10",
        "source_uri": "https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/no-rise/",
        "verification_status": "SOURCE_REVIEWED_RULESET_PINNING_REQUIRED",
        "rule": "Indiana DNR cumulative surcharge criteria are distinct from FEMA/local no-rise requirements; pin applicable rule version and project context before applying a threshold.",
    },
    "IL": {
        "citation": "17 Ill. Adm. Code Part 3700",
        "source_uri": "https://www.ilga.gov/commission/jcar/admincode/017/017037000000400R.html",
        "verification_status": "NO_UNIVERSAL_THRESHOLD_CONFIGURED",
        "rule": "Part 3700 governs floodway construction and permitting; do not treat 0.10 ft as a universal statutory project threshold without section- and context-specific verification.",
    },
    "KY": {
        "citation": "401 KAR 4:060",
        "source_uri": "https://apps.legislature.ky.gov/law/kar/titles/401/004/060/",
        "verification_status": "DISTINCT_BOUNDARY_AND_PROJECT_CRITERIA",
        "rule": "The rule's one-foot water-surface-rise criterion for defining regulatory floodway boundaries does not establish a universal zero-rise requirement for every project.",
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
        numeric_inputs = (stage_ft_navd88, bfe_ft_navd88)
        if any(
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            for value in numeric_inputs
        ):
            raise ValueError("stage_ft_navd88 and bfe_ft_navd88 must be finite numbers.")
        if floodway_delta_ft is not None and (
            isinstance(floodway_delta_ft, bool)
            or not isinstance(floodway_delta_ft, (int, float))
            or not math.isfinite(floodway_delta_ft)
        ):
            raise ValueError("floodway_delta_ft must be finite when supplied.")
        if not isinstance(floodway_context, str) or floodway_context not in {"FEMA", "STATE", "UNKNOWN"}:
            raise ValueError("floodway_context must be FEMA, STATE, or UNKNOWN.")

        jurisdiction_code = self._jurisdiction(jurisdiction)
        reasons: list[str] = []
        flags: list[str] = []

        if not authoritative_model_id:
            flags.append("AUTHORITATIVE_MODEL_NOT_ATTACHED")
            reasons.append(
                "Screening is provisional because no authoritative hydraulic model identifier "
                "was supplied; no regulatory determination is produced."
            )

        if source_evidence_hash is not None and (
            len(source_evidence_hash) != 64
            or any(ch not in "0123456789abcdefABCDEF" for ch in source_evidence_hash)
        ):
            raise ValueError("source_evidence_hash must be a 64-character hexadecimal SHA-256 value.")

        delta = floodway_delta_ft
        if delta is None:
            flags.append("FLOODWAY_DELTA_NOT_PROVIDED")
            reasons.append("Floodway model delta was not supplied; no-rise or surcharge criteria were not evaluated.")
        elif floodway_context == "FEMA" and delta > 0.0:
            flags.append("FEMA_NO_RISE_REVIEW_REQUIRED")
            reasons.append("Positive modeled rise in FEMA context requires separate applicable no-rise review; this screen does not certify it.")
        elif floodway_context == "UNKNOWN":
            flags.append("FLOODWAY_CONTEXT_UNKNOWN")
            reasons.append("Floodway context is unknown; federal, state, and local criteria cannot be selected safely.")

        if stage_ft_navd88 > bfe_ft_navd88:
            flags.append("STAGE_ABOVE_BFE")
            reasons.append(
                f"Stage {stage_ft_navd88:.3f} ft exceeds supplied BFE {bfe_ft_navd88:.3f} ft; "
                "this is an engineering screening observation, not a permit determination."
            )

        if not source_evidence_hash:
            flags.append("SOURCE_EVIDENCE_HASH_MISSING")
            reasons.append("Source evidence is not hash-pinned; provenance review is required.")
        screening_status = "SCREENED_NO_TRIGGER" if not flags else "SCREENED_WITH_TRIGGERS"
        return {
            "engine": ENGINE_VERSION,
            "status": "EVALUATED",
            "screening_status": screening_status,
            "jurisdiction": jurisdiction_code,
            "regulatory_determination": None,
            "human_review_required": True,
            "governance_gate": "BLOCKED",
            "governance_block_reasons": ["READ_ONLY_ENGINE", "QUALIFIED_HUMAN_REVIEW_REQUIRED", "NO_AUTOMATIC_PERMIT_OR_DESIGN_AUTHORIZATION"],
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
            "input_record": {
                "jurisdiction": jurisdiction_code,
                "stage_ft_navd88": stage_ft_navd88,
                "bfe_ft_navd88": bfe_ft_navd88,
                "floodway_delta_ft": floodway_delta_ft,
                "floodway_context": floodway_context,
                "authoritative_model_id": authoritative_model_id,
                "source_evidence_hash": source_evidence_hash,
            },
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

        canonical_json = lambda value: json.dumps(
            value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
        )
        input_record = evaluation_result.get("input_record")
        if not isinstance(input_record, dict):
            raise ValueError("Evaluation result is missing its canonical input_record.")

        manifest: dict[str, Any] = {
            "manifest_type": "TSM_ARCHIMEDES_SCREENING_PROOF",
            "engine_version": ENGINE_VERSION,
            "node_id": self.node_id,
            "governance_status": "BLOCKED_HUMAN_REVIEW_REQUIRED",
            "human_review_status": "REVIEW_METADATA_RECORDED" if signed else "unsigned",
            "reviewer_identity": reviewer_identity.strip() if signed else None,
            "review_reason": review_reason.strip() if signed else None,
            "reviewed_at": now if signed else None,
            "input_hash_sha256": hashlib.sha256(canonical_json(input_record).encode("utf-8")).hexdigest(),
            "evaluation_hash_sha256": hashlib.sha256(canonical_json(evaluation_result).encode("utf-8")).hexdigest(),
            "solver_hash_sha256": None,
            "solver_status": "NOT_EVALUATED",
            "evaluation_body": evaluation_result,
            "disclaimer": (
                "Technology informs people; it does not silently govern people. "
                "Integrity metadata is not authorization. This artifact is screening evidence, not a regulatory determination, permit, or approved engineering design."
            ),
        }

        canonical = canonical_json(manifest)
        manifest["proof_hash_sha256"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return manifest
