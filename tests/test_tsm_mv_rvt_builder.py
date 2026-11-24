"""Headless fake-Unreal material graph test of pin topology; NOT shader compilation.

By using the UE5.8 documented material pin names and explicit node connectivity,
this catches accidental wiring of a WorldHeight sample's FIRST (color) output
instead of the actual World Height pin and catches Power Base/Exp misuse.
"""
import importlib.util
import types
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "tsm-native/Content/Python/tsm_mv_rvt.py"
spec = importlib.util.spec_from_file_location("tsm_mv_rvt", PATH)
rvt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rvt)

PINS = {
    "MaterialExpressionConstant3Vector": ([], [""]),
    "MaterialExpressionConstant": ([], [""]),
    "MaterialExpressionScalarParameter": ([], [""]),
    "MaterialExpressionRuntimeVirtualTextureOutput": (
        ["BaseColor", "Normal", "Roughness", "Specular", "WorldHeight"], []),
    "MaterialExpressionRuntimeVirtualTextureSample": (
        [], ["Base Color", "Roughness", "Specular", "Normal", "World Height"]),
    "MaterialExpressionWorldPosition": ([], ["XYZ"]),
    "MaterialExpressionComponentMask": (["Input"], ["R", "G", "B", "A"]),
    "MaterialExpressionVertexColor": ([], ["R", "G", "B", "A"]),
    "MaterialExpressionSubtract": (["A", "B"], [""]),
    "MaterialExpressionDivide": (["A", "B"], [""]),
    "MaterialExpressionMultiply": (["A", "B"], [""]),
    "MaterialExpressionPower": (["Base", "Exp"], [""]),
    "MaterialExpressionSaturate": (["Input"], [""]),
    "MaterialExpressionAbs": (["Input"], [""]),
    "MaterialExpressionMax": (["A", "B"], [""]),
    "MaterialExpressionLinearInterpolate": (["A", "B", "Alpha"], [""]),
}


class FakeNode:
    def __init__(self, classname):
        self.classname = classname
        self.properties = {}

    def set_editor_property(self, name, value):
        self.properties[name] = value

    def set_editor_properties(self, values):
        self.properties.update(values)


class FakeMaterial:
    def get_path_name(self):
        return "/Game/MockMaterial"


class FakeEdit:
    nodes = []
    wires = []
    material_wires = []
    recompiled = []

    @classmethod
    def reset(cls):
        cls.nodes, cls.wires, cls.material_wires, cls.recompiled = [], [], [], []

    @classmethod
    def create_material_expression(cls, mat, node_class, x, y):
        node = FakeNode(node_class.__name__)
        cls.nodes.append(node)
        return node

    @classmethod
    def get_material_expression_input_names(cls, node):
        return PINS[node.classname][0]

    @classmethod
    def get_material_expression_output_names(cls, node):
        return PINS[node.classname][1]

    @classmethod
    def connect_material_expressions(cls, source, source_pin, target, target_pin):
        if source_pin not in ("", *PINS[source.classname][1]):
            return False
        if target_pin not in PINS[target.classname][0]:
            return False
        cls.wires.append((source, source_pin, target, target_pin))
        return True

    @classmethod
    def connect_material_property(cls, source, source_pin, property_name):
        cls.material_wires.append((source, source_pin, property_name))
        return True

    @classmethod
    def layout_material_expressions(cls, mat):
        pass

    @classmethod
    def recompile_material(cls, mat):
        cls.recompiled.append(mat)


class FakeAssetLibrary:
    @staticmethod
    def save_loaded_asset(mat):
        return True


def make_unreal():
    namespace = types.SimpleNamespace()
    namespace.MaterialEditingLibrary = FakeEdit
    namespace.EditorAssetLibrary = FakeAssetLibrary
    namespace.LinearColor = lambda *args: tuple(args)
    namespace.Name = str
    namespace.MaterialProperty = types.SimpleNamespace(
        MP_BASE_COLOR="MP_BASE_COLOR", MP_NORMAL="MP_NORMAL",
        MP_ROUGHNESS="MP_ROUGHNESS", MP_SPECULAR="MP_SPECULAR")
    namespace.RuntimeVirtualTextureMaterialType = types.SimpleNamespace(
        BASE_COLOR_NORMAL_SPECULAR="surface", WORLD_HEIGHT="height")
    for cls in PINS:
        setattr(namespace, cls, type(cls, (), {}))
    return namespace


class RvtGraphTopology(unittest.TestCase):
    def setUp(self):
        FakeEdit.reset()
        self.unreal = make_unreal()

    def test_landscape_outputs_worldheight_as_a_separate_rvt_channel(self):
        rvt._build_landscape(self.unreal, FakeMaterial())
        output = next(n for n in FakeEdit.nodes
                      if n.classname == "MaterialExpressionRuntimeVirtualTextureOutput")
        pins = {w[3] for w in FakeEdit.wires if w[2] is output}
        self.assertEqual(pins, {"BaseColor", "Normal", "Roughness", "Specular",
                                "WorldHeight"})
        self.assertIn("MP_BASE_COLOR", {e[2] for e in FakeEdit.material_wires})
        self.assertEqual(len(FakeEdit.recompiled), 1)

    def _assert_height_connected_to_subtract(self):
        height_samples = [n for n in FakeEdit.nodes
                          if n.classname == "MaterialExpressionRuntimeVirtualTextureSample"
                          and n.properties.get("material_type") == "height"]
        self.assertEqual(len(height_samples), 1)
        relevant = [w for w in FakeEdit.wires
                    if w[0] is height_samples[0] and w[3] == "B"
                    and w[2].classname == "MaterialExpressionSubtract"]
        self.assertEqual(len(relevant), 1)
        self.assertEqual(relevant[0][1], "World Height")

    def test_road_uses_worldheight_and_vertex_red_feather(self):
        rvt._build_road(self.unreal, FakeMaterial(), "surface_rvt", "height_rvt")
        self._assert_height_connected_to_subtract()
        self.assertTrue(any(w[0].classname == "MaterialExpressionVertexColor"
                            and w[1] == "R" and w[2].classname == "MaterialExpressionMax"
                            for w in FakeEdit.wires))
        self.assertIn("MP_BASE_COLOR", {e[2] for e in FakeEdit.material_wires})

    def test_foundation_height_mask_uses_power_base_and_exp(self):
        rvt._build_foundation(self.unreal, FakeMaterial(), "surface_rvt",
                              "height_rvt")
        self._assert_height_connected_to_subtract()
        power = next(n for n in FakeEdit.nodes if n.classname == "MaterialExpressionPower")
        power_pins = {w[3] for w in FakeEdit.wires if w[2] is power}
        self.assertEqual(power_pins, {"Base", "Exp"})
        self.assertEqual(len(FakeEdit.recompiled), 1)


if __name__ == "__main__":
    unittest.main()
