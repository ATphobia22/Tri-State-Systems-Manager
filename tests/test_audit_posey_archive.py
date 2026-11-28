"""Security and provenance regression fixtures for the independent offline audit."""
import io
import subprocess
import json
import struct
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'geospatial'))
from audit_posey_archive import audit, check_glb, AuditError  # noqa: E402


def glb():
    payload = json.dumps({'asset': {'version': '2.0'}}).encode()
    chunk = payload + b' ' * (-len(payload) % 4)
    return struct.pack('<III', 0x46546C67, 2, 20 + len(chunk)) + struct.pack('<I4s', len(chunk), b'JSON') + chunk


def fixture(d, ids=(1, 2), tiles=(1, 2), unsafe=False, safe_link=False, unsafe_link=False):
    zpath = d / 'source.zip'; tpath = d / 'tiles.tar'
    inv = {'source_identity_complete': True, 'official_feature_count': len(ids), 'county': 'Posey', 'source_objectid_field': 'objectid'}
    import hashlib
    body = (json.dumps(inv) + '\n').encode()
    with zipfile.ZipFile(zpath, 'w') as z:
        z.writestr('posey-source-inventory.json', body)
        z.writestr('posey-source-inventory.json.sha256', f'{hashlib.sha256(body).hexdigest()}  posey-source-inventory.json\n')
        z.writestr('raw-pages/igio-posey-000000-000199.json', json.dumps({'features': [{'attributes': {'objectid': i}, 'geometry': {'rings': [[[0,0],[1,0],[0,1],[0,0]]]}} for i in ids]}))
    with tarfile.open(tpath, 'w') as t:
        files = {f'flat/{i}.glb': glb() for i in tiles}
        files['flat/manifest.json'] = json.dumps({'source': {'sourceFeatureCount': len(tiles)},'input': {'featureCount': len(tiles), 'heightSources': {'OBSERVED': len(tiles), 'DERIVED':0}}}).encode()
        files['flat/tileset.json'] = json.dumps({'asset': {'version': '1.1'},'root': {'children': [{'content': {'uri': f'{i}.glb'}} for i in tiles]}}).encode()
        if unsafe: files['../outside.json'] = b'bad'
        for name, data in files.items():
            info = tarfile.TarInfo(name); info.size = len(data)
            t.addfile(info, io.BytesIO(data))
        if safe_link or unsafe_link:
            item = tarfile.TarInfo("flat-local/1.glb")
            item.type = tarfile.SYMTYPE
            item.linkname = "../flat/1.glb" if safe_link else "../../outside.glb"
            t.addfile(item)
    return zpath, tpath


class AuditPoseyTests(unittest.TestCase):
    def test_glb_rejects_corrupt_length(self):
        blob = glb()
        with self.assertRaises(AuditError): check_glb(blob[:-1])

    def test_complete_fixture_passes_identity_but_not_measured_acceptance(self):
        with tempfile.TemporaryDirectory() as tmp:
            a,b=fixture(Path(tmp))
            result=audit(a,b)
            self.assertEqual(result['identity']['missing_source_ids'],0)
            self.assertEqual(result['asset_integrity']['glb_valid'],2)
            self.assertFalse(result['production_accepted'])

    def test_partial_fixture_fails_exact_source_reconciliation(self):
        with tempfile.TemporaryDirectory() as tmp:
            a,b=fixture(Path(tmp),ids=(1,2,3),tiles=(1,2))
            result=audit(a,b)
            self.assertEqual(result['identity']['missing_source_ids'],1)
            self.assertEqual(result['identity']['missing_source_id_sample'],[3])
            self.assertFalse(result['identity']['complete'])

    def test_allows_resolved_internal_readonly_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            a,b=fixture(Path(tmp),safe_link=True)
            result=audit(a,b)
            self.assertEqual(result["asset_integrity"]["internal_symlinks"], 1)

    def test_rejects_external_symlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            a,b=fixture(Path(tmp),unsafe_link=True)
            with self.assertRaises(AuditError): audit(a,b)

    def test_cli_refuses_partial_coverage_and_keeps_audit_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            d=Path(tmp)
            a,b=fixture(d, ids=(1,2,3), tiles=(1,2))
            output=d / "audit.json"
            script=Path(__file__).resolve().parents[1] / "scripts" / "geospatial" / "audit_posey_archive.py"
            result=subprocess.run([sys.executable,str(script),"--source-zip",str(a),"--tiles-tar",str(b),"--output",str(output)],capture_output=True,text=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(output.read_text())["identity"]["missing_source_ids"],1)

    def test_rejects_tar_path_traversal(self):
        with tempfile.TemporaryDirectory() as tmp:
            a,b=fixture(Path(tmp),unsafe=True)
            with self.assertRaises(AuditError): audit(a,b)

if __name__ == '__main__': unittest.main()
