import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'auto-3d-city-builder/pipeline/import_citygml.sh'


class ImportGuardTests(unittest.TestCase):
    def test_unvalidated_inputs_never_reach_docker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            trace = root / 'docker-called'
            docker = root / 'docker'
            docker.write_text('#!/bin/sh\ntouch "$TRACE"\nexit 0\n')
            docker.chmod(0o755)
            (root / 'synthetic.gml').write_text('<CityModel/>')
            env = dict(os.environ, PATH=f'{root}:{os.environ["PATH"]}', TRACE=str(trace))
            for args in ([], [tmp, 'synthetic.gml'], [tmp, 'missing.gml']):
                with self.subTest(args=args):
                    result = subprocess.run(['bash', str(SCRIPT), *args], env=env,
                                            capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(trace.exists())
                    self.assertIn('BLOCKED', result.stderr)
