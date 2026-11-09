"""Append-only SQLite Merkle transparency log for TSM evidence dossiers.

Each appended leaf commits a fully verified dossier Merkle root and its
canonical manifest digest. Every log head commits the complete prefix in RFC
9162 tree order. SQLite triggers prevent ordinary update/delete, but a DB
owner can replace the DB and its log head. Independently SIGN and publish each
tree head for production trust; local hash chains alone do not authenticate it.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from backend.merkle_evidence import (VERSION, canonical, inclusion_path, tree_hash,
                                     verify_inclusion, verify_manifest)

ROLES = frozenset({"government", "hydrology", "survey", "building", "regulatory", "other"})


def _body(record: dict) -> bytes:
    return canonical(record)


def _verified_rows(rows: list[tuple]) -> tuple[bool, list[bytes]]:
    payloads = []
    for index, body, declared_digest, declared_root in rows:
        if type(index) is not int or index != len(payloads):
            return False, []
        try:
            parsed = json.loads(body)
            if not isinstance(parsed, dict) or set(parsed) != {
                "schemaVersion", "dossierId", "role", "dossierMerkleRootSha256", "manifestSha256",
            } or parsed["schemaVersion"] != "tsm.merkle-log-leaf.v1":
                return False, []
            if _body(parsed).decode("utf8") != body:
                return False, []
        except (TypeError, ValueError, KeyError):
            return False, []
        if hashlib.sha256(body.encode("utf8")).hexdigest() != declared_digest:
            return False, []
        payloads.append(body.encode("utf8"))
        if tree_hash(payloads).hex() != declared_root:
            return False, []
    return True, payloads


class SQLiteMerkleEvidenceLog:
    def __init__(self, database: str | Path):
        self.database = str(database)
        with sqlite3.connect(self.database, timeout=15) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=FULL")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS evidence_merkle_log (
                    leaf_index INTEGER PRIMARY KEY,
                    dossier_id TEXT NOT NULL UNIQUE,
                    payload_json TEXT NOT NULL,
                    payload_sha256 TEXT NOT NULL,
                    log_root_sha256 TEXT NOT NULL,
                    inserted_at_utc TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS evidence_merkle_no_update
                BEFORE UPDATE ON evidence_merkle_log
                BEGIN SELECT RAISE(ABORT, 'MERKLE_LOG_APPEND_ONLY'); END
            """)
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS evidence_merkle_no_delete
                BEFORE DELETE ON evidence_merkle_log
                BEGIN SELECT RAISE(ABORT, 'MERKLE_LOG_APPEND_ONLY'); END
            """)

    def _connect(self):
        conn = sqlite3.connect(self.database, isolation_level=None, timeout=15)
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    @staticmethod
    def _records(conn):
        return conn.execute(
            "SELECT leaf_index,payload_json,payload_sha256,log_root_sha256 "
            "FROM evidence_merkle_log ORDER BY leaf_index").fetchall()

    def append(self, *, dossier_id: str, role: str,
               evidence_root: Path, manifest: dict) -> dict:
        if not isinstance(dossier_id, str) or not dossier_id.strip() or len(dossier_id) > 160:
            raise ValueError("DOSSIER_ID_REQUIRED")
        if role not in ROLES:
            raise ValueError("DOSSIER_ROLE_INVALID")
        if not verify_manifest(evidence_root, manifest):
            raise ValueError("DOSSIER_EVIDENCE_MERKLE_NOT_VERIFIED")
        body = {
            "schemaVersion": "tsm.merkle-log-leaf.v1",
            "dossierId": dossier_id,
            "role": role,
            "dossierMerkleRootSha256": manifest["merkleRootSha256"],
            "manifestSha256": hashlib.sha256(canonical(manifest)).hexdigest(),
        }
        payload = _body(body)
        conn = self._connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            stored = self._records(conn)
            okay, previous = _verified_rows(stored)
            if not okay:
                raise ValueError("MERKLE_LOG_INTEGRITY_INVALID")
            index = len(previous)
            root_hash = tree_hash(previous + [payload]).hex()
            conn.execute(
                "INSERT INTO evidence_merkle_log "
                "(leaf_index,dossier_id,payload_json,payload_sha256,log_root_sha256,inserted_at_utc) "
                "VALUES (?,?,?,?,?,?)",
                (index, dossier_id, payload.decode("utf8"), hashlib.sha256(payload).hexdigest(),
                 root_hash, datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
        except (sqlite3.IntegrityError, sqlite3.DatabaseError, ValueError):
            conn.rollback()
            raise
        finally:
            conn.close()
        return {
            "schemaVersion": "tsm.merkle-checkpoint.v1",
            "treeSize": index + 1, "leafIndex": index,
            "logRootSha256": root_hash,
            "dossierMerkleRootSha256": manifest["merkleRootSha256"],
            "manifestSha256": body["manifestSha256"],
            "logInclusionPath": inclusion_path(previous + [payload], index),
            "signedByExternalTrustAnchor": False,
            "regulatoryApproval": False,
        }

    def verify_integrity(self) -> bool:
        with self._connect() as conn:
            valid, _ = _verified_rows(self._records(conn))
            return valid

    def prove_dossier(self, dossier_id: str) -> dict:
        with self._connect() as conn:
            rows = self._records(conn)
        valid, payloads = _verified_rows(rows)
        if not valid:
            raise ValueError("MERKLE_LOG_INTEGRITY_INVALID")
        for index, payload in enumerate(payloads):
            body = json.loads(payload)
            if body["dossierId"] == dossier_id:
                return {
                    "schemaVersion": "tsm.merkle-log-inclusion.v1",
                    "treeSize": len(payloads), "leafIndex": index,
                    "rootSha256": tree_hash(payloads).hex(),
                    "leaf": body, "path": inclusion_path(payloads, index),
                }
        raise ValueError("DOSSIER_NOT_FOUND")

    @staticmethod
    def verify_dossier_proof(proof: dict) -> bool:
        try:
            if proof["schemaVersion"] != "tsm.merkle-log-inclusion.v1":
                return False
            return verify_inclusion(canonical(proof["leaf"]), proof["leafIndex"],
                                    proof["treeSize"], proof["path"], proof["rootSha256"])
        except (KeyError, TypeError, ValueError):
            return False
