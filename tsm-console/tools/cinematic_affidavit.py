"""
TSM Visualization Plane — Cinematic Affidavit Generator
Binds a rendered frame sequence number to a content hash.
Does NOT create regulatory determinations. authority_class = VISUALIZATION | DERIVED.
"""
from __future__ import annotations
from hashlib import sha256
from time import time
from typing import Any

try:
    from pydantic import BaseModel, ConfigDict
except ImportError:  # minimal fallback
    BaseModel = object  # type: ignore
    ConfigDict = dict  # type: ignore


class CinematicAffidavit(BaseModel):  # type: ignore
    model_config = ConfigDict(extra="forbid") if ConfigDict is not dict else None
    affidavit_id: str
    sequence: int
    pipeline_version: str
    content_hash_sha256: str
    parent_artifact_id: str | None
    certification_timestamp: float
    statement: str
    authority_class: str = "VISUALIZATION"
    is_simulation_demo: bool = True
    horizontal_crs: str = "EPSG:2966"
    vertical_datum: str = "NAVD88"


class AffidavitGenerator:
    def __init__(self, pipeline_version: str = "tsm-viz-1.0.0"):
        self.pipeline_version = pipeline_version

    def generate(
        self,
        sequence: int,
        content_hash_sha256: str,
        timestamp: float | None = None,
        parent_artifact_id: str | None = None,
    ) -> dict[str, Any]:
        ts = timestamp if timestamp is not None else time()
        seal = content_hash_sha256.lower().removeprefix("sha256:")
        statement = (
            f"Frame sequence {sequence} is associated with content hash {seal}. "
            f"This is a Visualization-plane certificate only. "
            f"It is not a FARA, No-Rise, or floodway determination. "
            f"CRS={CinematicAffidavit.model_fields['horizontal_crs'].default if hasattr(CinematicAffidavit, 'model_fields') else 'EPSG:2966'}."
        )
        raw = f"{sequence}:{seal}:{ts}:{self.pipeline_version}"
        affidavit_id = f"AFF-{sha256(raw.encode()).hexdigest()[:16].upper()}"
        return {
            "affidavit_id": affidavit_id,
            "sequence": sequence,
            "pipeline_version": self.pipeline_version,
            "content_hash_sha256": seal,
            "parent_artifact_id": parent_artifact_id,
            "certification_timestamp": ts,
            "statement": statement,
            "authority_class": "VISUALIZATION",
            "is_simulation_demo": True,
            "horizontal_crs": "EPSG:2966",
            "vertical_datum": "NAVD88",
        }


if __name__ == "__main__":
    import json
    g = AffidavitGenerator()
    print(json.dumps(g.generate(1045, "a" * 64), indent=2))
