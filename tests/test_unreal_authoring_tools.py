import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


configure = load('configure_unreal_tools').configure
create_manifest = load('create_unreal_asset_manifest').create_manifest
META = dict(source_uri='https://example.org/source', license='test fixture',
            horizontal_crs='test local CRS', vertical_datum='test datum',
            transform_record='test transform receipt')


class AuthoringTests(unittest.TestCase):
    def test_configure_preserves_settings_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp) / 'TSM.uproject'
            original = {'EngineAssociation': '5.8', 'Custom': 7,
                        'Plugins': [{'Name': 'OpenXR', 'Enabled': True}]}
            project.write_text(json.dumps(original))
            configure(project)
            once = project.read_bytes()
            configure(project)
            self.assertEqual(once, project.read_bytes())
            data = json.loads(once)
            self.assertEqual(data['Custom'], 7)
            self.assertIn({'Name': 'OpenXR', 'Enabled': True}, data['Plugins'])
            self.assertFalse(any(p['Name'] == 'Flow' for p in data['Plugins']))
            self.assertEqual(json.loads(project.with_suffix('.uproject.before-tools').read_text()), original)

    def test_missing_optional_plugin_does_not_modify_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp) / 'TSM.uproject'
            project.write_text('{"Plugins": []}')
            original = project.read_bytes()
            with self.assertRaisesRegex(ValueError, 'Install reviewed'):
                configure(project, flowgraph=True)
            self.assertEqual(original, project.read_bytes())

    def test_installed_optional_plugins_can_be_enabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            project = root / 'TSM.uproject'
            project.write_text('{}')
            for name in ('Flow', 'TSMTraining', 'HoudiniEngine'):
                directory = root / 'Plugins' / name
                directory.mkdir(parents=True)
                (directory / (name + '.uplugin')).write_text('{}')
            configure(project, houdini=True, flowgraph=True)
            plugins = {p['Name']: p for p in json.loads(project.read_text())['Plugins']}
            self.assertTrue(plugins['TSMTraining']['Enabled'])
            self.assertEqual(plugins['HoudiniEngine']['TargetAllowList'], ['Editor'])

    def test_manifest_checksum_metadata_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'Bridge.fbx').write_bytes(b'FBX test fixture')
            output = create_manifest(root, **META)
            row = json.loads(output.read_text())['assets'][0]
            self.assertEqual(row['sha256'], hashlib.sha256(b'FBX test fixture').hexdigest())
            self.assertEqual(row['asset_name'], 'SM_Bridge')
            self.assertEqual(row['vertical_datum'], META['vertical_datum'])
            with self.assertRaises(FileExistsError):
                create_manifest(root, **META)

    def test_case_insensitive_name_collision(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'bridge.fbx').touch()
            (root / 'SM_bridge.fbx').touch()
            with self.assertRaisesRegex(ValueError, 'Colliding'):
                create_manifest(root, **META)
            self.assertFalse((root / 'asset-manifest.json').exists())

    def test_empty_folder_and_missing_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, 'No FBX'):
                create_manifest(tmp, **META)
            with self.assertRaisesRegex(ValueError, 'Missing license'):
                create_manifest(tmp, **dict(META, license=''))


if __name__ == '__main__':
    unittest.main()
