from __future__ import annotations
import json, tempfile, unittest
from pathlib import Path
import h5py
import numpy as np
from backend.solver_evidence_adapters import inspect_hecras_run, inspect_modflow6_run, verify_bishop_result
from backend.engineering_evidence import ExecutionState, sha256_file
from backend.solvers.geotech import calculate_bishop_factor_of_safety

class SolverAdapterEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name)
        self.input=self.root/"input.dat"; self.input.write_text("input fixture\\n",encoding="utf-8")
    def tearDown(self): self.temp.cleanup()
    def test_hecras_requires_actual_hdf_and_explicit_log_success(self):
        hdf=self.root/"project.p01.hdf"; log=self.root/"compute.log"
        with h5py.File(hdf,"w") as handle:
            ds=handle.create_dataset("Results/Unsteady/Output/Output Blocks/Base Output/Unsteady Time Series/2D Flow Areas/Area 1/Water Surface",data=np.array([[1.0,2.0],[1.1,2.1]]))
        log.write_text("Computation completed successfully\\n",encoding="utf-8")
        result=inspect_hecras_run(run_id="hec-1",solver_version="fixture",project_hdf=hdf,computation_log=log,input_paths=[self.input])
        self.assertEqual(result.state,ExecutionState.VERIFIED.value)
        log.write_text("Computation failed: failed to converge\\n",encoding="utf-8")
        failed=inspect_hecras_run(run_id="hec-2",solver_version="fixture",project_hdf=hdf,computation_log=log,input_paths=[self.input])
        self.assertEqual(failed.state,ExecutionState.FAILED.value)
    def test_modflow_requires_listing_outputs_and_mass_balance(self):
        listing=self.root/"model.lst"; heads=self.root/"model.hds"; budget=self.root/"model.cbc"; report=self.root/"mass.json"
        listing.write_text("NORMAL TERMINATION OF SIMULATION\\n",encoding="utf-8")
        heads.write_bytes(b"head output fixture"); budget.write_bytes(b"budget output fixture")
        report.write_text(json.dumps({"relative_mass_balance_error":0.001,"tolerance":0.01,"source_listing_sha256":sha256_file(listing).sha256,"extraction_method":"test fixture parser"}),encoding="utf-8")
        args=dict(run_id="mf-1",solver_version="fixture",listing_file=listing,head_file=heads,budget_file=budget,mass_balance_report=report,input_paths=[self.input],max_relative_mass_balance_error=0.02)
        self.assertEqual(inspect_modflow6_run(**args).state,ExecutionState.VERIFIED.value)
        report.write_text(json.dumps({"relative_mass_balance_error":0.5,"tolerance":0.01,"source_listing_sha256":sha256_file(listing).sha256,"extraction_method":"test fixture parser"}),encoding="utf-8")
        self.assertEqual(inspect_modflow6_run(**{**args,"run_id":"mf-2"}).state,ExecutionState.FAILED.value)
        listing.write_text("FAILED TO CONVERGE\\n",encoding="utf-8")
        self.assertEqual(inspect_modflow6_run(**{**args,"run_id":"mf-3"}).state,ExecutionState.NON_CONVERGENT.value)
    def test_bishop_result_must_match_deterministic_replay(self):
        inputs={"cohesion_kpa":12.0,"friction_angle_deg":28.0,"slice_weights_kn":[100.0,120.0,110.0],"slice_widths_m":[2.0,2.0,2.0],"alpha_angles_deg":[8.0,12.0,10.0],"pore_pressure_kpa":[4.0,5.0,4.5]}
        result=calculate_bishop_factor_of_safety(**inputs)
        evidence=verify_bishop_result(result=result,solver_inputs=inputs,input_artifact_paths=[self.input],run_id="bishop-1")
        self.assertEqual(evidence.state,ExecutionState.VERIFIED.value)
        changed={**result,"factor_of_safety":999.0}
        tampered=verify_bishop_result(result=changed,solver_inputs=inputs,input_artifact_paths=[self.input],run_id="bishop-2")
        self.assertEqual(tampered.state,ExecutionState.FAILED.value)
if __name__=="__main__": unittest.main()
