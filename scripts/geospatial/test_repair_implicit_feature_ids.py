import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path

from repair_implicit_feature_ids import repair_glb
from test_build_implicit_tileset import MODULE, make_fixture_glb
from validate_feature_linkage import implicit_glb_object_ids


def encode(doc, binary):
    encoded = json.dumps(doc).encode()
    encoded += b' ' * (-len(encoded) % 4)
    body = struct.pack('<I4s', len(encoded), b'JSON') + encoded
    body += struct.pack('<I4s', len(binary), b'BIN\0') + binary
    return struct.pack('<4sII', b'glTF', 2, 12 + len(body)) + body


class RepairTests(unittest.TestCase):
    def test_repair_preserves_geometry_and_source_identity_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'mesh.glb'
            make_fixture_glb(path)
            path.write_bytes(MODULE.merge_glbs([(path, 740387), (path, 741040)]))
            doc, binary = MODULE.read_glb(path)
            old_binary = bytearray(binary)
            for row, primitive in enumerate(doc['meshes'][0]['primitives']):
                accessor = doc['accessors'][primitive['attributes']['_FEATURE_ID_0']]
                view = doc['bufferViews'][accessor['bufferView']]
                struct.pack_into('<' + 'I' * accessor['count'], old_binary, view['byteOffset'], *([row] * accessor['count']))
                accessor['componentType'] = 5125
            doc['extensions']['EXT_structural_metadata']['schema']['id'] = 'tsm-building-feature-schema'
            fixed = repair_glb(encode(doc, old_binary))
            self.assertEqual(repair_glb(fixed), fixed)
            path.write_bytes(fixed)
            actual_doc, actual_binary = MODULE.read_glb(path)
            self.assertEqual(actual_binary, binary)
            self.assertEqual(actual_doc['extensions']['EXT_structural_metadata']['schema']['id'], 'tsm_building_feature_schema')
            violations = []
            self.assertEqual(implicit_glb_object_ids(path, violations), {740387, 741040})
            self.assertEqual(violations, [])
            # Float IDs must remain integral, finite and in range.
            accessor = actual_doc['accessors'][actual_doc['meshes'][0]['primitives'][0]['attributes']['_FEATURE_ID_0']]
            view = actual_doc['bufferViews'][accessor['bufferView']]
            for bad in (-1.0, 0.5, float('nan'), float('inf'), 2.0):
                corrupt = bytearray(actual_binary)
                struct.pack_into('<f', corrupt, view['byteOffset'], bad)
                path.write_bytes(encode(actual_doc, corrupt))
                violations = []
                implicit_glb_object_ids(path, violations)
                self.assertTrue(violations, repr(bad))


class MalformedFeatureLayoutTests(unittest.TestCase):
    def fixture(self, temp):
        path = Path(temp) / 'mesh.glb'
        make_fixture_glb(path)
        path.write_bytes(MODULE.merge_glbs([(path, 101), (path, 202)]))
        return path, *MODULE.read_glb(path)

    def test_rejects_accessor_layouts_that_read_other_views_or_skip_vertices(self):
        import copy
        with tempfile.TemporaryDirectory() as temp:
            path, doc, binary = self.fixture(temp)
            index = doc['meshes'][0]['primitives'][0]['attributes']['_FEATURE_ID_0']
            view = doc['accessors'][index]['bufferView']
            mutations = [
                lambda d: d['bufferViews'][view].update(byteLength=4),
                lambda d: d['bufferViews'][view].update(byteStride=8),
                lambda d: d['bufferViews'][view].update(buffer=1),
                lambda d: d['accessors'][index].update(normalized=True),
                lambda d: d['accessors'][index].update(sparse={}),
                lambda d: d['accessors'][index].update(byteOffset=2),
            ]
            for mutate in mutations:
                corrupt = copy.deepcopy(doc)
                mutate(corrupt)
                path.write_bytes(encode(corrupt, binary))
                violations = []
                implicit_glb_object_ids(path, violations)
                self.assertTrue(violations, repr(corrupt['accessors'][index]))
                with self.assertRaises(ValueError):
                    repair_glb(path.read_bytes())

    def test_repair_refuses_different_views_aliasing_the_feature_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            path, doc, binary = self.fixture(temp)
            index = doc['meshes'][0]['primitives'][0]['attributes']['_FEATURE_ID_0']
            accessor = doc['accessors'][index]
            view = doc['bufferViews'][accessor['bufferView']]
            old = bytearray(binary)
            struct.pack_into('<' + 'I' * accessor['count'], old, view['byteOffset'], *([0] * accessor['count']))
            accessor['componentType'] = 5125
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': view['byteOffset'], 'byteLength': 4})
            with self.assertRaisesRegex(ValueError, 'overlapping'):
                repair_glb(encode(doc, old))

    def test_linkage_rejects_vertex_count_and_feature_count_mismatches(self):
        import copy
        with tempfile.TemporaryDirectory() as temp:
            path, doc, binary = self.fixture(temp)
            for field in ('vertex', 'feature'):
                corrupt = copy.deepcopy(doc)
                primitive = corrupt['meshes'][0]['primitives'][0]
                if field == 'vertex':
                    corrupt['accessors'][primitive['attributes']['_FEATURE_ID_0']]['count'] = 2
                else:
                    primitive['extensions']['EXT_mesh_features']['featureIds'][0]['featureCount'] = 1
                path.write_bytes(encode(corrupt, binary))
                violations = []
                implicit_glb_object_ids(path, violations)
                self.assertTrue(violations, field)


if __name__ == '__main__':
    unittest.main()
