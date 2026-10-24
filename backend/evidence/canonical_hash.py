"""Canonical JSON hashing and evidence sealing for TSM solver runs.

This is the Python counterpart of the TypeScript ``stableJson`` /
``hashEvidencePayload`` helpers in ``packages/evidence/src/index.ts``. It
exists because the pasted other-AI ``hashPayload`` implementation is buggy:
``JSON.stringify(payload, Object.keys(payload).sort())`` uses the sorted keys
as an array replacer, which drops nested object keys. This module implements
a true canonical stringifier: object keys are sorted recursively at every
depth, arrays keep their order, and no keys are dropped.

Evidence model (mirrors the TS side):
- ``seal_evidence`` computes ``evidence_bundle_hash`` over the evidence body
  (everything except the hash field itself).
- ``verify_integrity`` recomputes the hash and compares; any tampering with
  any field changes the digest.
- Hashes are lowercase hex SHA-256 without a prefix in stored records; the
  ``sha256:`` prefixed form is accepted on verify for pasted-material
  compatibility.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> str:
    """Recursively canonical JSON: sorted keys at every depth, arrays ordered."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        items = sorted(value.items(), key=lambda kv: str(kv[0]))
        return "{" + ",".join(
            json.dumps(str(key), ensure_ascii=False) + ":" + canonical_json(val)
            for key, val in items
        ) + "}"
    raise TypeError(f"canonical_json cannot encode {type(value).__name__}")


def hash_payload(payload: Any) -> str:
    """Lowercase hex SHA-256 of the canonical JSON encoding."""
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def hash_bytes(data: bytes) -> str:
    """Lowercase hex SHA-256 of raw bytes (e.g. HDF5 / head / budget files)."""
    return hashlib.sha256(data).hexdigest()


def seal_evidence(evidence: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of ``evidence`` with ``evidence_bundle_hash`` attached.

    The hash covers the body only; a pre-existing ``evidence_bundle_hash``
    key is excluded before hashing so sealing is idempotent.
    """
    body = {k: v for k, v in evidence.items() if k != "evidence_bundle_hash"}
    sealed = dict(body)
    sealed["evidence_bundle_hash"] = hash_payload(body)
    return sealed


def verify_integrity(evidence: dict[str, Any]) -> bool:
    """True iff the stored bundle hash matches a recomputation over the body."""
    stored = evidence.get("evidence_bundle_hash")
    if not isinstance(stored, str):
        return False
    stored = stored[7:] if stored.startswith("sha256:") else stored
    body = {k: v for k, v in evidence.items() if k != "evidence_bundle_hash"}
    try:
        return stored == hash_payload(body)
    except TypeError:
        return False
