import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / 'auto-3d-city-builder/pipeline'


class ReconstructionEntrypointTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.pipeline = self.root / 'auto-3d-city-builder/pipeline'
        self.pipeline.mkdir(parents=True)
        for name in ('run_pdal_then_citygml.sh', 'run_full_dem_dsm_buildings.sh'):
            source = SCRIPTS / name
            if source.exists():
                shutil.copy(source, self.pipeline / name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.trace = self.root / 'trace'
        self.env = dict(os.environ, PATH=f'{self.bin}:{os.environ["PATH"]}',
                        TRACE=str(self.trace), ENGINE_EXIT='0')
        for name in ('pdal', 'docker'):
            self.stub(name, f'echo {name} >> "$TRACE"\nexit 7')
        self.stub('ogr2ogr', 'exit 0')
        self.stub('roofer', 'exit 0')
        self.stub('python3', 'printf "%s\\n" "$@" >> "$TRACE"\nexit "$ENGINE_EXIT"')
        (self.pipeline / 'import_citygml.sh').write_text('echo IMPORT >> "$TRACE"\n')
        (self.root / 'auto-3d-city-builder/docker').mkdir()
        fixture = self.root / 'data/citygml'
        fixture.mkdir(parents=True)
        (fixture / 'mount_vernon_lod1_sample.gml').write_text('synthetic fixture')
        self.review = self.root / 'review input'
        self.review.mkdir()
        self.out = self.root / 'new output'
        self.args = ['--review', str(self.review), str(self.out), '--pdal',
                     str(self.bin / 'pdal'), '--ogr2ogr', str(self.bin / 'ogr2ogr'),
                     '--roofer', str(self.bin / 'roofer')]

    def stub(self, name, body):
        path = self.bin / name
        path.write_text('#!/bin/sh\n' + body + '\n')
        path.chmod(0o755)

    def invoke(self, args, name='run_pdal_then_citygml.sh'):
        return subprocess.run(['bash', str(self.pipeline / name), *args],
                              env=self.env, capture_output=True, text=True)

    def events(self):
        return self.trace.read_text() if self.trace.exists() else ''

    def test_no_arguments_cannot_import_fixture(self):
        self.assertNotEqual(self.invoke([]).returncode, 0)
        self.assertEqual(self.events(), '')

    def test_production_is_blocked_before_external_commands(self):
        self.assertNotEqual(self.invoke(['--production']).returncode, 0)
        self.assertEqual(self.events(), '')

    def test_review_invokes_evidence_bound_engine_without_database(self):
        self.assertEqual(self.invoke(self.args).returncode, 0)
        self.assertIn('citybuilder.pdal_roofer\n', self.events())
        self.assertIn(str(self.review), self.events())
        self.assertNotIn('IMPORT', self.events())
        self.assertNotIn('docker\n', self.events())

    def test_engine_failure_propagates(self):
        self.env['ENGINE_EXIT'] = '17'
        self.assertEqual(self.invoke(self.args).returncode, 17)
        self.assertNotIn('IMPORT', self.events())

    def test_parent_propagates_engine_failure(self):
        self.env['ENGINE_EXIT'] = '17'
        self.assertEqual(self.invoke(self.args, 'run_full_dem_dsm_buildings.sh').returncode, 17)
        self.assertNotIn('IMPORT', self.events())


if __name__ == '__main__':
    unittest.main()
