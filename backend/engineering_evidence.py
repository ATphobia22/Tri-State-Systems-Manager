"""Fail-closed scientific solver evidence, durable ledger, and signature verification."""
from __future__ import annotations
import hashlib, json, math, sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Any, Iterable
class ExecutionState(StrEnum):
    NOT_EVALUATED="NOT_EVALUATED"; VERIFIED="VERIFIED"; FAILED="FAILED"; TIMEOUT="TIMEOUT"; CANCELLED="CANCELLED"; NON_CONVERGENT="NON_CONVERGENT"; DATA_ERROR="DATA_ERROR"; UNIT_MISMATCH="UNIT_MISMATCH"; DATUM_MISMATCH="DATUM_MISMATCH"; GATE_BLOCKED_BY_SOLVER_ERROR="GATE_BLOCKED_BY_SOLVER_ERROR"
@dataclass(frozen=True)
class ArtifactDigest:
    role: str; path: str; byte_length: int; sha256: str
@dataclass(frozen=True)
class SolverEvidence:
    schema_version: str; run_id: str; solver: str; solver_version: str | None; state: str
    inputs: tuple[ArtifactDigest,...]; outputs: tuple[ArtifactDigest,...]; convergence_evidence: str | None
    validation_messages: tuple[str,...]; created_at_utc: str; evidence_sha256: str
def sha256_bytes(payload: bytes) -> str: return hashlib.sha256(payload).hexdigest()
def _canonical_json(value: Any) -> bytes: return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode("utf-8")
def sha256_file(path: str | Path) -> ArtifactDigest:
    target=Path(path)
    if not target.is_file() or target.is_symlink(): raise ValueError(f"ARTIFACT_NOT_A_REGULAR_FILE:{target}")
    digest=hashlib.sha256(); size=0
    with target.open("rb") as stream:
        for block in iter(lambda:stream.read(1024*1024),b""): size+=len(block); digest.update(block)
    return ArtifactDigest("artifact",target.name,size,digest.hexdigest())
def build_solver_evidence(*,run_id:str,solver:str,solver_version:str|None,input_paths:Iterable[str|Path],output_paths:Iterable[str|Path],convergence_evidence:str|None,explicit_state:ExecutionState,validation_messages:Iterable[str]=(),created_at_utc:str|None=None)->SolverEvidence:
    """Hash real files and explicit adapter findings; never infer success from process status."""
    if not run_id.strip() or not solver.strip(): raise ValueError("RUN_ID_AND_SOLVER_REQUIRED")
    inputs=tuple(ArtifactDigest("input",d.path,d.byte_length,d.sha256) for d in map(sha256_file,input_paths))
    outputs=tuple(ArtifactDigest("output",d.path,d.byte_length,d.sha256) for d in map(sha256_file,output_paths))
    messages=tuple(str(m) for m in validation_messages); state=explicit_state
    if state==ExecutionState.VERIFIED and (not outputs or not convergence_evidence or messages): state=ExecutionState.NOT_EVALUATED; messages+=("VERIFICATION_PRECONDITIONS_NOT_MET",)
    created=created_at_utc or datetime.now(timezone.utc).isoformat()
    parsed=datetime.fromisoformat(created.replace("Z","+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() is None: raise ValueError("EVIDENCE_TIMESTAMP_MUST_INCLUDE_TIMEZONE")
    body={"schema_version":"tsm.solver-evidence.v1","run_id":run_id,"solver":solver,"solver_version":solver_version,"state":state.value,"inputs":[asdict(x) for x in inputs],"outputs":[asdict(x) for x in outputs],"convergence_evidence":convergence_evidence,"validation_messages":list(messages),"created_at_utc":created}
    return SolverEvidence(schema_version=body["schema_version"],run_id=run_id,solver=solver,solver_version=solver_version,state=state.value,inputs=inputs,outputs=outputs,convergence_evidence=convergence_evidence,validation_messages=messages,created_at_utc=created,evidence_sha256=sha256_bytes(_canonical_json(body)))
def verify_evidence_hash(e:SolverEvidence)->bool:
    body={"schema_version":e.schema_version,"run_id":e.run_id,"solver":e.solver,"solver_version":e.solver_version,"state":e.state,"inputs":[asdict(x) for x in e.inputs],"outputs":[asdict(x) for x in e.outputs],"convergence_evidence":e.convergence_evidence,"validation_messages":list(e.validation_messages),"created_at_utc":e.created_at_utc}
    return e.evidence_sha256==sha256_bytes(_canonical_json(body))
def verify_ed25519_signature(payload:bytes,signature:bytes,public_key:bytes)->bool:
    """Verify Ed25519 only; never sign or approve an artifact."""
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    except ImportError as exc: raise RuntimeError("cryptography package required for Ed25519 verification") from exc
    try: Ed25519PublicKey.from_public_bytes(public_key).verify(signature,payload); return True
    except (InvalidSignature,ValueError,TypeError): return False
class SQLiteEvidenceLedger:
    """Local durable append-only ledger; production multi-instance use should use PostgreSQL."""
    def __init__(self,database_path:str|Path)->None:
        self.database_path=str(database_path)
        with self._connect() as c:
            c.execute("PRAGMA journal_mode=WAL")
            c.execute("""CREATE TABLE IF NOT EXISTS solver_evidence_ledger(sequence INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL UNIQUE,evidence_json TEXT NOT NULL,evidence_sha256 TEXT NOT NULL,previous_record_sha256 TEXT,record_sha256 TEXT NOT NULL UNIQUE,inserted_at_utc TEXT NOT NULL)""")
    def _connect(self):
        c=sqlite3.connect(self.database_path,timeout=10); c.execute("PRAGMA foreign_keys=ON"); return c
    def append(self,e:SolverEvidence)->str:
        if not verify_evidence_hash(e): raise ValueError("EVIDENCE_HASH_INVALID")
        payload=_canonical_json(asdict(e)).decode("utf-8")
        with self._connect() as c:
            row=c.execute("SELECT record_sha256 FROM solver_evidence_ledger ORDER BY sequence DESC LIMIT 1").fetchone(); previous=row[0] if row else None
            record={"run_id":e.run_id,"evidence_json":payload,"evidence_sha256":e.evidence_sha256,"previous_record_sha256":previous}; digest=sha256_bytes(_canonical_json(record))
            c.execute("INSERT INTO solver_evidence_ledger(run_id,evidence_json,evidence_sha256,previous_record_sha256,record_sha256,inserted_at_utc) VALUES(?,?,?,?,?,?)",(e.run_id,payload,e.evidence_sha256,previous,digest,datetime.now(timezone.utc).isoformat()))
        return digest
    def verify_chain(self)->bool:
        with self._connect() as c: rows=c.execute("SELECT run_id,evidence_json,evidence_sha256,previous_record_sha256,record_sha256 FROM solver_evidence_ledger ORDER BY sequence").fetchall()
        previous=None
        for run_id,payload,evidence_hash,link,record_hash in rows:
            if link!=previous: return False
            try: parsed=json.loads(payload)
            except json.JSONDecodeError: return False
            if parsed.get("evidence_sha256")!=evidence_hash: return False
            expected=sha256_bytes(_canonical_json({"run_id":run_id,"evidence_json":payload,"evidence_sha256":evidence_hash,"previous_record_sha256":link}))
            if expected!=record_hash: return False
            previous=record_hash
        return True
def validate_exchange_metadata(*,units:str,expected_units:str,horizontal_crs:str,expected_horizontal_crs:str,vertical_datum:str,expected_vertical_datum:str,timestamp:str,now_utc:datetime|None=None,max_age_seconds:float=300.0)->ExecutionState:
    """Reject mismatches/stale values; perform no implicit conversions."""
    if units!=expected_units: return ExecutionState.UNIT_MISMATCH
    if horizontal_crs!=expected_horizontal_crs or vertical_datum!=expected_vertical_datum: return ExecutionState.DATUM_MISMATCH
    try: instant=datetime.fromisoformat(timestamp.replace("Z","+00:00"))
    except ValueError: return ExecutionState.DATA_ERROR
    if instant.tzinfo is None or instant.utcoffset() is None: return ExecutionState.DATA_ERROR
    now=now_utc or datetime.now(timezone.utc); age=(now-instant.astimezone(timezone.utc)).total_seconds()
    if not math.isfinite(age) or age < -5 or age > max_age_seconds: return ExecutionState.DATA_ERROR
    return ExecutionState.VERIFIED
