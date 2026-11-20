"""Synthetic atomic release staging tests; real IfcOpenShell smoke test is separate."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from scripts.geospatial import run_ifc_review_pipeline as runner
from scripts.geospatial.test_build_ifc_review_package import ReviewPipelineTests, sha

class RunPipelineTests(unittest.TestCase):
    def setUp(self):
        fixture=ReviewPipelineTests("test_generates_usable_review_contract_and_real_node_links")
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        self.f=fixture
        self.output=fixture.root/"whole-pipeline"
        self.crosswalk=fixture.root/"crosswalk-source.json"
        self.crosswalk.write_text("{}")
        self.registry=fixture.root/"registry-source.json"
        self.registry.write_text("{}")
        self.converter=fixture.root/"IfcConvert"
        self.converter.write_text("synthetic executable")
        self.converter.chmod(0o700)

    def preflight(self, source, output, expected_sha, expected_crs, datum):
        self.assertEqual(expected_sha,self.f.d)
        output.write_bytes(self.f.preflight.read_bytes())
        return json.loads(output.read_text())

    def convert(self, source, preflight, crosswalk, registry, converter, output_dir):
        glb=output_dir/"ifc-model.glb"
        glb.write_bytes(self.f.glb.read_bytes())
        row=dict(self.f.bridge_data)
        row["preflightSha256"]=sha(preflight.read_bytes())
        (output_dir/"ifc-model-asset-bridge.json").write_text(json.dumps(row))
        return row

    def run(self):
        return runner.run(self.f.ifc,self.f.intake,self.crosswalk,self.registry,
                          self.converter,self.output,"fixture","rev1")

    def test_manifest_checksums_and_unplaced_release(self):
        with patch.object(runner,"preflight",side_effect=self.preflight), \
             patch.object(runner,"convert",side_effect=self.convert):
            result=self.run()
        self.assertEqual(result["status"],"METADATA_READY_GEOMETRY_UNPLACED")
        self.assertFalse(result["modelOverlayPermitted"])
        self.assertFalse(result["terrainClipPermitted"])
        self.assertEqual(result["inputHashes"]["ifc"],self.f.d)
        self.assertEqual(result["reviewElementCount"],2)
        self.assertEqual(result["glbNodeGuidLinkCount"],2)
        for name,digest in result["outputHashes"].items():
            self.assertEqual(sha((self.output/name).read_bytes()),digest)
        self.assertTrue((self.output/"design-review.json").is_file())
        self.assertEqual(list(self.f.root.glob(".geobim-stage-*")),[])

    def test_failed_converter_does_not_publish_partial_release(self):
        with patch.object(runner,"preflight",side_effect=self.preflight), \
             patch.object(runner,"convert",side_effect=RuntimeError("CONVERTER_FAILED")):
            with self.assertRaisesRegex(RuntimeError,"CONVERTER_FAILED"):
                self.run()
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.f.root.glob(".geobim-stage-*")),[])

    def test_existing_release_cannot_be_overwritten(self):
        self.output.mkdir()
        with self.assertRaisesRegex(ValueError,"OUTPUT_EXISTS"):
            self.run()

if __name__=="__main__":
    unittest.main()
