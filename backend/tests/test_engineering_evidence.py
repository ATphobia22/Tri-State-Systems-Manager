from __future__ import annotations
import json, sqlite3, tempfile, unittest
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from backend.engineering_evidence import ExecutionState, SQLiteEvidenceLedger, build_solver_evidence, validate_exchange_metadata, verify_evidence_hash
class EngineeringEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name); self.input=self.root/"input.dat"; self.output=self.root/"output.dat"
        self.input.write_text("model input\\n",encoding="utf-8"); self.output.write_text("solver output fixture\\n",encoding="utf-8")
    def tearDown(self): self.temp.cleanup()
    def evidence(self,**overrides):
        args=dict(run_id="test-run-1",solver="MODFLOW 6",solver_version="fixture",input_paths=[self.input],output_paths=[self.output],convergence_evidence="fixture: convergence independently inspected",explicit_state=ExecutionState.VERIFIED,created_at_utc="2026-10-24T12:00:00+00:00")
        args.update(overrides); return build_solver_evidence(**args)
    def test_exit_success_without_convergence_evidence_is_not_verified(self): self.assertEqual(self.evidence(convergence_evidence=None).state,"NOT_EVALUATED")
    def test_missing_output_is_not_accepted(self):
        with self.assertRaises(ValueError): self.evidence(output_paths=[self.root/"missing.hds"])
    def test_nonconvergence_timeout_crash_and_cancel_states_are_preserved(self):
        for state in (ExecutionState.NON_CONVERGENT,ExecutionState.TIMEOUT,ExecutionState.FAILED,ExecutionState.CANCELLED):
            with self.subTest(state=state): self.assertEqual(self.evidence(explicit_state=state).state,state.value)
    def test_hash_tampering_is_detected(self):
        e=self.evidence(); self.assertTrue(verify_evidence_hash(e)); self.assertFalse(verify_evidence_hash(replace(e,solver_version="tampered")))
    def test_durable_ledger_and_tamper_detection(self):
        ledger=SQLiteEvidenceLedger(self.root/"ledger.sqlite"); ledger.append(self.evidence(run_id="a")); ledger.append(self.evidence(run_id="b")); self.assertTrue(ledger.verify_chain())
        with sqlite3.connect(self.root/"ledger.sqlite") as c: c.execute("UPDATE solver_evidence_ledger SET evidence_json=? WHERE run_id=?",(json.dumps({"tampered":True}),"a"))
        self.assertFalse(ledger.verify_chain())
    def test_units_crs_and_vertical_datum_mismatch(self):
        now=datetime(2026,10,24,12,tzinfo=timezone.utc); args=dict(units="ft",expected_units="ft",horizontal_crs="EPSG:2966",expected_horizontal_crs="EPSG:2966",vertical_datum="NAVD88",expected_vertical_datum="NAVD88",timestamp=now.isoformat(),now_utc=now)
        self.assertEqual(validate_exchange_metadata(**{**args,"units":"m"}),ExecutionState.UNIT_MISMATCH)
        self.assertEqual(validate_exchange_metadata(**{**args,"vertical_datum":"NGVD29"}),ExecutionState.DATUM_MISMATCH)
        self.assertEqual(validate_exchange_metadata(**{**args,"horizontal_crs":"EPSG:4326"}),ExecutionState.DATUM_MISMATCH)
    def test_stale_and_naive_telemetry_rejected(self):
        now=datetime(2026,10,24,12,tzinfo=timezone.utc); args=dict(units="ft",expected_units="ft",horizontal_crs="EPSG:2966",expected_horizontal_crs="EPSG:2966",vertical_datum="NAVD88",expected_vertical_datum="NAVD88",now_utc=now,max_age_seconds=60)
        self.assertEqual(validate_exchange_metadata(**args,timestamp="2026-10-24T11:00:00+00:00"),ExecutionState.DATA_ERROR)
        self.assertEqual(validate_exchange_metadata(**args,timestamp="2026-10-24T11:59:59"),ExecutionState.DATA_ERROR)
if __name__=="__main__": unittest.main()
