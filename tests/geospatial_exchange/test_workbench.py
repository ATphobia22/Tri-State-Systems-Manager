import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('workbench', Path(__file__).resolve().parents[2] / 'tools/geospatial_exchange/workbench.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_inventory_hash_and_symlink(self):
        p = self.root / 'scan.e57'; p.write_bytes(b'fixture')
        self.assertEqual(m.inventory(self.root)['assets'][0]['sha256'], m.sha(p))
        (self.root / 'link').symlink_to(p)
        with self.assertRaises(ValueError): m.inventory(self.root)

    def test_stac_retains_quality_metadata_and_paging(self):
        d = {'type': 'FeatureCollection', 'features': [{'id': 'x', 'collection': 'continuous',
             'properties': {'qualifier': 'P'}, 'assets': {'data': {'href': 'https://example.org/a.parquet'}}}],
             'links': [{'rel': 'next', 'href': 'next'}]}
        result = m.stac_plan(d)
        self.assertFalse(result['complete'])
        self.assertEqual(result['assets'][0]['properties'], {'qualifier': 'P'})

    def test_duckdb_actual_parquet_roundtrip(self):
        import duckdb
        p = self.root / 'input.parquet'; out = self.root / 'snapshot.duckdb'
        con = duckdb.connect()
        con.sql("SELECT '03378500' AS station, 3.5 AS stage, 'P' AS qualifier").write_parquet(str(p))
        con.close()
        m.parquet_database([p], out)
        con = duckdb.connect(str(out), read_only=True)
        self.assertEqual(con.sql('SELECT station, qualifier FROM source_0').fetchone(), ('03378500', 'P'))
        self.assertEqual(con.sql('SELECT sha256 FROM source_manifest').fetchone()[0], m.sha(p))
        con.close()
        with self.assertRaises(ValueError): m.parquet_database([p], out)

    def test_tool_failure_retained(self):
        receipt = self.root / 'failure.json'
        with self.assertRaises(RuntimeError):
            m.run_tool(sys.executable, ['-c', 'raise SystemExit(7)'], receipt)
        self.assertEqual(json.loads(receipt.read_text())['exitCode'], 7)

if __name__ == '__main__': unittest.main()
