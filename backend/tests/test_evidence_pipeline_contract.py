import json
import pathlib
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTRACT_PATH = REPO_ROOT / "data" / "engineering" / "evidence-pipeline-contract.json"


class TestEvidencePipelineContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with CONTRACT_PATH.open("r", encoding="utf-8") as handle:
            cls.contract = json.load(handle)

    def test_contract_has_required_structure(self) -> None:
        self.assertIsInstance(self.contract.get("stages"), list)
        self.assertIsInstance(self.contract.get("controls"), dict)
        self.assertIsInstance(self.contract.get("terminal_stages"), list)
        self.assertIsInstance(self.contract.get("evaluation"), dict)

    def test_stage_ids_are_unique_and_dependencies_exist(self) -> None:
        stages = self.contract["stages"]
        ids = [stage["id"] for stage in stages]
        self.assertEqual(len(ids), len(set(ids)))

        known_ids = set(ids)
        for stage in stages:
            for dependency in stage.get("depends_on", []):
                self.assertIn(dependency, known_ids)

    def test_dependency_graph_is_acyclic(self) -> None:
        stages = {stage["id"]: stage for stage in self.contract["stages"]}

        def visit(stage_id: str, visiting: set[str], visited: set[str]) -> None:
            if stage_id in visiting:
                self.fail(f"Cycle detected in evidence pipeline at {stage_id}")
            if stage_id in visited:
                return

            visiting.add(stage_id)
            for dependency in stages[stage_id].get("depends_on", []):
                visit(dependency, visiting, visited)
            visiting.remove(stage_id)
            visited.add(stage_id)

        visited: set[str] = set()
        for stage_id in stages:
            visit(stage_id, set(), visited)

    def test_fail_closed_controls_are_enabled(self) -> None:
        controls = self.contract["controls"]
        required_true = (
            "no_downstream_without_upstream",
            "bathymetry_required_for_submerged_channel",
            "datum_must_be_explicit",
            "earthwork_must_be_independent",
            "sediment_not_structural_fill_by_default",
            "agency_eligibility_is_not_inferred",
            "funding_is_not_an_award",
            "human_engineering_review_required",
        )
        for control in required_true:
            with self.subTest(control=control):
                self.assertIs(controls.get(control), True)

    def test_stage_dependency_order_is_preserved(self) -> None:
        stages = {stage["id"]: stage for stage in self.contract["stages"]}
        self.assertEqual(stages["environmental_screening"]["depends_on"], ["sediment_suitability"])
        self.assertEqual(stages["agency_eligibility"]["depends_on"], ["environmental_screening"])
        self.assertEqual(stages["qa_qc"]["depends_on"], ["funding_application"])

    def test_terminal_stage_is_qa_qc(self) -> None:
        self.assertEqual(self.contract["terminal_stages"], ["qa_qc"])
        self.assertEqual(
            self.contract["evaluation"]["evaluated_by"],
            "scripts/ci/validate-engineering-pipeline.mjs",
        )


if __name__ == "__main__":
    unittest.main()
