"""PostgreSQL adapter for the TSM scientific evidence ledger.

The caller supplies a DSN from its deployment secret/configuration store. This
module does not read or log credentials and never applies migrations itself.
"""
from __future__ import annotations

import json
from typing import Any

from backend.engineering_evidence import SolverEvidence, _canonical_json, sha256_bytes, verify_evidence_hash


class PostgresEvidenceLedger:
    """Append and verify evidence using the migration-managed PostgreSQL tables."""

    def __init__(self, dsn: str) -> None:
        if not dsn or not dsn.strip():
            raise ValueError("POSTGRES_DSN_REQUIRED")
        self._dsn = dsn

    def append(self, evidence: SolverEvidence) -> str:
        if not verify_evidence_hash(evidence):
            raise ValueError("EVIDENCE_HASH_INVALID")
        try:
            import psycopg2
        except ImportError as exc:
            raise RuntimeError("psycopg2 is required for PostgreSQL evidence storage") from exc

        evidence_json = _canonical_json({
            "schema_version": evidence.schema_version,
            "run_id": evidence.run_id,
            "solver": evidence.solver,
            "solver_version": evidence.solver_version,
            "state": evidence.state,
            "inputs": [vars(item) for item in evidence.inputs],
            "outputs": [vars(item) for item in evidence.outputs],
            "convergence_evidence": evidence.convergence_evidence,
            "validation_messages": list(evidence.validation_messages),
            "created_at_utc": evidence.created_at_utc,
            "evidence_sha256": evidence.evidence_sha256,
        }).decode("utf-8")
        with psycopg2.connect(self._dsn) as connection:
            with connection.cursor() as cursor:
                # Serialize chain writers to prevent concurrent forks.
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", (741_930_125,))
                cursor.execute("SELECT record_sha256 FROM solver_evidence_ledger ORDER BY sequence DESC LIMIT 1")
                row = cursor.fetchone()
                previous = row[0] if row else None
                record_hash = sha256_bytes(_canonical_json({
                    "run_id": evidence.run_id,
                    "evidence_sha256": evidence.evidence_sha256,
                    "previous_record_sha256": previous,
                }))
                cursor.execute(
                    """INSERT INTO solver_evidence_ledger
                    (run_id,schema_version,solver_name,solver_version,execution_state,
                     evidence_json,evidence_sha256,previous_record_sha256,record_sha256,created_at_utc)
                    VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s::timestamptz)""",
                    (evidence.run_id,evidence.schema_version,evidence.solver,evidence.solver_version,
                     evidence.state,evidence_json,evidence.evidence_sha256,previous,record_hash,
                     evidence.created_at_utc),
                )
        return record_hash

    def verify_chain(self) -> bool:
        try:
            import psycopg2
        except ImportError as exc:
            raise RuntimeError("psycopg2 is required for PostgreSQL evidence storage") from exc
        with psycopg2.connect(self._dsn) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """SELECT run_id,evidence_json,evidence_sha256,previous_record_sha256,record_sha256
                    FROM solver_evidence_ledger ORDER BY sequence"""
                )
                rows = cursor.fetchall()
        previous = None
        for run_id, evidence_json, evidence_hash, link, record_hash in rows:
            if link != previous:
                return False
            payload = evidence_json if isinstance(evidence_json, dict) else json.loads(evidence_json)
            claimed_hash = payload.pop("evidence_sha256", None)
            if claimed_hash != evidence_hash or sha256_bytes(_canonical_json(payload)) != evidence_hash:
                return False
            expected = sha256_bytes(_canonical_json({
                "run_id": run_id,
                "evidence_sha256": evidence_hash,
                "previous_record_sha256": link,
            }))
            if expected != record_hash:
                return False
            previous = record_hash
        return True
