"""Verify CC0 FGDC symbol integrity and non-promoting geology integration."""
import hashlib
import importlib.util
import json
import xml.etree.ElementTree as ET
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "data/standards/fgdc-upstream-reuse-review-v1.json"
ASSET = ROOT / "tsm-console/public/geology/fgdc/101-C.svg"
RENDERER = ROOT / "tsm-console/src/lib/fgdc-geology-pattern.ts"


class GeologyStyleTests(unittest.TestCase):
    def test_registry_contains_all_reviewed_repos(self):
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        self.assertEqual(registry["schema"], "tsm-fgdc-upstream-reuse-review")
        self.assertEqual(len(registry["repositories"]), 10)
        self.assertEqual(len({r["name"] for r in registry["repositories"]}), 10)

    def test_cc0_svg_has_exact_upstream_git_blob(self):
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        record = registry["bundledAssets"][0]
        asset = ROOT / record["path"]
        self.assertEqual(asset, ASSET)
        self.assertEqual(record["license"], "CC0-1.0")
        content = asset.read_bytes()
        header = ("blob " + str(len(content)) + "\0").encode("ascii")
        self.assertEqual(hashlib.sha1(header + content).hexdigest(), record["originGitBlobSha1"])
        root = ET.fromstring(content)
        self.assertEqual(root.tag, "{http://www.w3.org/2000/svg}svg")
        # No scripts, event handlers, embedded cross-origin images or links in
        # the one bundled illustration; avoid installing arbitrary SVGs.
        self.assertFalse(any(node.tag.rsplit("}", 1)[-1] in ("script", "foreignObject", "image") for node in root.iter()))
        self.assertFalse(any(any("href" in key or key.lower().startswith("on") for key in node.attrib) for node in root.iter()))

    def test_maplibre_uses_bundled_asset_no_fake_geology(self):
        renderer = RENDERER.read_text(encoding="utf-8")
        self.assertIn("geology/fgdc/101-C.svg", renderer)
        self.assertIn("registerLocalFGDCGeologyPattern", renderer)
        self.assertIn("NOT_ASSIGNED_WITHOUT_AUTHORITATIVE_MAP_LEGEND", renderer)
        self.assertIn("import.meta.env.BASE_URL", renderer)


if __name__ == "__main__":
    unittest.main()
