#!/usr/bin/env python3
import json, math, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/geospatial/build-hlod-tileset.py"
CONFIG = ROOT / "scripts/geospatial/hlod-quadtree-config.json"

class HlodContract(unittest.TestCase):
    def test_config_and_conservative_obb(self):
        with tempfile.TemporaryDirectory() as td:
            src, out = Path(td) / "flat.json", Path(td) / "hlod.json"
            tile = lambda i: {
                "boundingVolume":{"box":[6378137+i*20,0,0,2,0,0,0,2,0,0,0,4]},
                "geometricError":0, "refine":"ADD",
                "content":{"uri":f"building-{i}.glb"},
                "extras":{"tsm":{"sourceObjectId":i}}}
            src.write_text(json.dumps({"asset":{"version":"1.1"},
                "geometricError":16, "root":{"geometricError":16,"children":[tile(i) for i in range(4)]}}))
            subprocess.run([sys.executable,str(SCRIPT),"--input",str(src),
                "--output",str(out),"--config",str(CONFIG),"--max-items","1"],check=True,capture_output=True)
            data=json.loads(out.read_text())
            self.assertEqual(data["extras"]["tsm"]["maxItemsPerLeaf"],1)
            self.assertEqual(data["extras"]["tsm"]["boundsPaddingMeters"],0.5)
            self.assertEqual(data["root"]["geometricError"],16)
            self.assertGreaterEqual(len(data["root"]["children"]),2)
            def walk(n):
                self.assertTrue(all(math.isfinite(x) for x in n["boundingVolume"]["box"]))
                self.assertGreaterEqual(n["geometricError"],0)
                for child in n.get("children",[]):walk(child)
            walk(data["root"])

    def test_bad_config_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            src, out, config = [Path(td)/p for p in ("flat.json","hlod.json","config.json")]
            src.write_text(json.dumps({"asset":{"version":"1.1"},"root":{"children":[{"boundingVolume":{"box":[6378137,0,0,1,0,0,0,1,0,0,0,1]},"content":{"uri":"x.glb"}}]}}))
            config.write_text(json.dumps({"schema":"tsm.hlod.quadtree.v1","maxItemsPerLeaf":1,"maxDepth":1,"boundsPaddingMeters":-1}))
            p=subprocess.run([sys.executable,str(SCRIPT),"--input",str(src),"--output",str(out),"--config",str(config)],capture_output=True,text=True)
            self.assertNotEqual(p.returncode,0)
            self.assertIn("invalid bounds padding",p.stderr+p.stdout)

    def test_explicit_default_size_overrides_config(self):
        with tempfile.TemporaryDirectory() as directory:
            source, output, config = [Path(directory) / name for name in ("flat.json", "hlod.json", "config.json")]
            source.write_text(json.dumps({"asset": {"version": "1.1"}, "root": {"children": [
                {"boundingVolume": {"box": [6378137, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]},
                 "content": {"uri": "tile.glb"}},
            ]}}))
            config.write_text(json.dumps({"schema": "tsm.hlod.quadtree.v1", "maxItemsPerLeaf": 5, "maxDepth": 0}))
            subprocess.run([sys.executable, str(SCRIPT), "--input", str(source), "--output", str(output),
                "--config", str(config), "--max-items", "50"], check=True, capture_output=True)
            settings = json.loads(output.read_text())["extras"]["tsm"]
            self.assertEqual(settings["maxItemsPerLeaf"], 50)
            self.assertEqual(settings["maxDepth"], 0)

if __name__=="__main__": unittest.main()
