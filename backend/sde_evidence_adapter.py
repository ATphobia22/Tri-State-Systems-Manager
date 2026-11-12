"""Offline SDE reasoning-graph adapter for the existing TSM SQLite evidence ledger.

The Rust sde-graph executable owns chunk storage and cryptographic restoration.
This adapter records the resulting files in the existing append-only scientific
evidence ledger under NOT_EVALUATED, never VERIFIED/approved automatically.
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
from typing import Any

from backend.engineering_evidence import (
    ExecutionState,
    SQLiteEvidenceLedger,
    build_solver_evidence,
    sha256_file,
)


class SDEEvidenceAdapter:
    def __init__(
        self,
        executable: str | Path,
        object_root: str | Path,
        sqlite_ledger: str | Path,
        *,
        timeout_seconds: int = 120,
    ) -> None:
        self.executable = Path(executable).resolve(strict=True)
        untrusted_root = Path(object_root)
        if untrusted_root.is_symlink():
            raise ValueError("SDE_STORE_SYMLINK_REJECTED")
        self.object_root = untrusted_root.resolve()
        if not self.executable.is_file() or timeout_seconds < 1 or timeout_seconds > 3600:
            raise ValueError("SDE_EXECUTABLE_OR_TIMEOUT_INVALID")
        self.object_root.mkdir(parents=True, exist_ok=True)
        self.ledger = SQLiteEvidenceLedger(sqlite_ledger)
        self.timeout_seconds = timeout_seconds

    def _run(self, args: list[str]) -> None:
        completed = subprocess.run(
            [str(self.executable), *args],
            shell=False,
            check=False,
            capture_output=True,
            text=True,
            timeout=self.timeout_seconds,
        )
        if completed.returncode:
            # Do not echo subprocess output: could include sensitive input paths.
            raise RuntimeError(f"SDE_COMMAND_FAILED:exit={completed.returncode}")

    def ingest(
        self,
        graph_path: str | Path,
        provenance_path: str | Path,
        record_output: str | Path,
        *,
        run_id: str,
    ) -> dict[str, Any]:
        if not run_id or not run_id.strip():
            raise ValueError("SDE_RUN_ID_REQUIRED")
        for original in (Path(graph_path), Path(provenance_path)):
            if original.is_symlink():
                raise ValueError("SDE_INPUT_SYMLINK_REJECTED")
        graph = Path(graph_path).resolve(strict=True)
        provenance = Path(provenance_path).resolve(strict=True)
        record = Path(record_output).resolve()
        for file in (graph, provenance):
            if not file.is_file() or file.is_symlink():
                raise ValueError("SDE_INPUT_NOT_REGULAR_FILE")
        if graph.stat().st_size > 32 * 1024 * 1024 or provenance.stat().st_size > 1024 * 1024:
            raise ValueError("SDE_INPUT_SIZE_EXCEEDED")
        if record.exists() or record in (graph, provenance):
            raise FileExistsError("SDE_RECORD_OUTPUT_ALREADY_EXISTS")
        record.parent.mkdir(parents=True, exist_ok=True)
        self._run(["ingest", str(self.object_root), str(graph), str(provenance), str(record)])
        self._run(["verify", str(self.object_root), str(record)])
        parsed = json.loads(record.read_text(encoding="utf-8"))
        if (
            parsed.get("schema") != "tsm.sde.evidence-record.v2"
            or parsed.get("review_state") != "UNVERIFIED"
        ):
            raise ValueError("SDE_RECORD_SCHEMA_OR_REVIEW_STATE_INVALID")
        if sha256_file(provenance).sha256 != parsed.get("provenance_sha256"):
            raise ValueError("SDE_PROVENANCE_HASH_MISMATCH")

        evidence = build_solver_evidence(
            run_id=run_id,
            solver="SDEReasoningGraph",
            solver_version="0.1.0",
            input_paths=(graph, provenance),
            output_paths=(record,),
            convergence_evidence=None,
            explicit_state=ExecutionState.NOT_EVALUATED,
            validation_messages=(
                "SDE_STORAGE_INTEGRITY_VERIFIED",
                "NEURAL_INFERENCE_NOT_EVIDENCED",
                "SCIENTIFIC_REVIEW_NOT_EVALUATED",
            ),
        )
        chain_hash = self.ledger.append(evidence)
        if not self.ledger.verify_chain():
            raise RuntimeError("SDE_EVIDENCE_LEDGER_CHAIN_INVALID")
        return {
            "schema": "tsm.sde.ingest-result.v1",
            "run_id": run_id,
            "graph_sha256": parsed["graph_sha256"],
            "provenance_sha256": parsed["provenance_sha256"],
            "record_sha256": sha256_file(record).sha256,
            "ledger_record_sha256": chain_hash,
            "scientific_review_state": "NOT_EVALUATED",
            "storage_integrity": "VERIFIED",
        }
