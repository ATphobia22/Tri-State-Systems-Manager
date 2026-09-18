#!/usr/bin/env python3
"""Tamper-evident audit record writer.

Private keys are supplied by an external secret manager. This module does not
generate or persist signing keys. Ed25519 authenticates a record; immutable
storage is required separately for immutability.
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


def canonical_json(record: dict[str, Any]) -> bytes:
    return json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def load_private_key() -> Ed25519PrivateKey:
    pem = os.environ.get("TSM_AUDIT_PRIVATE_KEY_PEM")
    if not pem:
        raise RuntimeError("TSM_AUDIT_PRIVATE_KEY_PEM is required; use an external secret manager")
    key = serialization.load_pem_private_key(pem.encode("utf-8"), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise TypeError("TSM audit key must be an Ed25519 private key")
    return key


def build_record(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not event_type.strip():
        raise ValueError("event_type must be non-empty")
    return {
        "schema": "tsm.audit.v1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "payload": payload,
    }


def sign_record(record: dict[str, Any], private_key: Ed25519PrivateKey) -> str:
    return base64.b64encode(private_key.sign(canonical_json(record))).decode("ascii")


def write_record(path: Path, record: dict[str, Any], private_key: Ed25519PrivateKey) -> None:
    envelope = {
        "record": record,
        "signature_ed25519": sign_record(record, private_key),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(envelope, sort_keys=True, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
