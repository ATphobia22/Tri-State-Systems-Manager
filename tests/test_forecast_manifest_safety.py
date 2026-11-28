"""The planning CLI must never overwrite or escape its evidence directory."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/flood-forecasting/run_all.py'
spec = importlib.util.spec_from_file_location('forecast_runner_safety', SCRIPT)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ForecastManifestSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        p = patch.object(runner, 'ROOT', self.root)
        p.start()
        self.addCleanup(p.stop)
        self.output = self.root / 'data/forecast_runs'

    def invoke(self, job):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return runner.main(['run_all.py', job])

    def test_rejects_path_traversal_before_writing(self):
        for job in ('../../escape', str(self.root / 'absolute'), 'nested/entry', '..', 'x\\escape'):
            with self.subTest(job=job):
                self.assertNotEqual(self.invoke(job), 0)
        self.assertFalse(self.output.exists())
        self.assertFalse((self.root / 'escape.json').exists())
        self.assertFalse((self.root / 'absolute.json').exists())

    def test_existing_manifest_is_never_overwritten(self):
        self.assertEqual(self.invoke('batch-1'), 0)
        target = self.output / 'batch-1.json'
        original = target.read_bytes()
        self.assertNotEqual(self.invoke('batch-1'), 0)
        self.assertEqual(target.read_bytes(), original)

    def test_symlinked_manifest_cannot_overwrite_external_file(self):
        self.output.mkdir(parents=True)
        victim = self.root / 'original.json'
        victim.write_text('preserve')
        (self.output / 'batch.json').symlink_to(victim)
        self.assertNotEqual(self.invoke('batch'), 0)
        self.assertEqual(victim.read_text(), 'preserve')

    def test_symlinked_output_directory_is_rejected(self):
        self.output.parent.mkdir()
        outside = self.root / 'outside'
        outside.mkdir()
        self.output.symlink_to(outside, target_is_directory=True)
        self.assertNotEqual(self.invoke('batch'), 0)
        self.assertEqual(list(outside.iterdir()), [])

    def test_new_manifest_preserves_planning_status_and_hash(self):
        self.assertEqual(self.invoke('batch-2'), 0)
        manifest = json.loads((self.output / 'batch-2.json').read_text())
        expected = manifest.pop('manifest_sha256')
        self.assertEqual(runner.sha256_obj(manifest), expected)
        self.assertNotIn('SUCCESS', [x['status'] for x in manifest['steps'].values()])


if __name__ == '__main__':
    unittest.main()
