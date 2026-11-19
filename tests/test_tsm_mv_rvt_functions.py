"""Headless graph-topology tests for reusable RVT contact MaterialFunctions.

This verifies typed input/output nodes and blend graph wiring using fake
Unreal editor APIs, NOT compiled shader outputs.
"""
import importlib.util
import sys
import types
import unittest
from pathlib import Path

from test_tsm_mv_rvt_builder import PINS, FakeEdit, make_unreal, rvt

# The MaterialFunction module imports the same expression-wiring helpers.
sys.modules.setdefault("tsm_mv_rvt", rvt)
MODULE = Path(__file__).resolve().parents[1] / "tsm-native/Content/Python/tsm_mv_rvt_functions.py"
spec = importlib.util.spec_from_file_location("tsm_mv_rvt_functions", MODULE)
functions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(functions)

PINS.update({
    "MaterialExpressionFunctionInput": ([], [""]),
    "MaterialExpressionFunctionOutput": (["A"], []),
})


class MaterialFunctionGraphTest(unittest.TestCase):
    def setUp(self):
        FakeEdit.reset()
        # A Material Function builds nodes into a MaterialFunction, not a Material.
        FakeEdit.create_material_expression_in_function = classmethod(
            lambda cls, fn, klass, x, y: cls.create_material_expression(fn, klass, x, y))
        self.u = make_unreal()
        self.u.MaterialExpressionFunctionInput = type("MaterialExpressionFunctionInput", (), {})
        self.u.MaterialExpressionFunctionOutput = type("MaterialExpressionFunctionOutput", (), {})
        self.u.FunctionInputType = types.SimpleNamespace(
            FUNCTION_INPUT_VECTOR3="vec3", FUNCTION_INPUT_SCALAR="scalar")

    def _outputs(self):
        return {n.properties.get("output_name") for n in FakeEdit.nodes
                if n.classname == "MaterialExpressionFunctionOutput"}

    def _inputs(self):
        return {n.properties.get("input_name") for n in FakeEdit.nodes
                if n.classname == "MaterialExpressionFunctionInput"}

    def test_foundation_has_typed_external_rvt_inputs_not_nested_sampling(self):
        functions._build_foundation(self.u, object())
        self.assertEqual(self._outputs(),
                         {"BlendedBaseColor", "BlendedRoughness", "BlendAlpha"})
        self.assertIn("LandscapeWorldZCm", self._inputs())
        self.assertIn("BlendHeightCm", self._inputs())
        self.assertIn("BlendExponent", self._inputs())
        self.assertFalse(any(n.classname == "MaterialExpressionRuntimeVirtualTextureSample"
                             for n in FakeEdit.nodes))
        power = next(n for n in FakeEdit.nodes if n.classname == "MaterialExpressionPower")
        self.assertEqual({w[3] for w in FakeEdit.wires if w[2] is power},
                         {"Base", "Exp"})

    def test_road_exposes_vertex_coverage_and_ground_height(self):
        functions._build_road(self.u, object())
        self.assertEqual(self._outputs(),
                         {"BlendedBaseColor", "BlendedRoughness", "BlendAlpha"})
        self.assertIn("EdgeCoverage", self._inputs())
        self.assertIn("MaxContactDeltaCm", self._inputs())
        self.assertTrue(any(n.classname == "MaterialExpressionMax" for n in FakeEdit.nodes))
        self.assertEqual(len([n for n in FakeEdit.nodes
                              if n.classname == "MaterialExpressionFunctionInput"]), 8)


if __name__ == "__main__":
    unittest.main()
