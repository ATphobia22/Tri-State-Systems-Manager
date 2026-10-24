"""Offline tests for tessera-tristate-download.py.

Covers the no-network surface: SHA-256 helper, provenance manifest
contents (store URL, CRS, CC-BY-SA license, read-only access), and the
privacy-safe sample-clip constants (rounded, NOT anchor-targeted).
"""

import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

import numpy as np


MODULE_PATH = Path(__file__).resolve().parents[1] / "tessera-tristate-download.py"
SPEC = importlib.util.spec_from_file_location("tessera_tristate_download_test_module", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

from tsm_config import ANCHOR_UTM_E, ANCHOR_UTM_N

try:
    import zarr  # noqa: F401

    _HAS_ZARR = True
except ImportError:
    _HAS_ZARR = False


class TesseraManifestTests(unittest.TestCase):
    def setUp(self) -> None:
        import tempfile
        self._td = tempfile.TemporaryDirectory()
        self.tmp = Path(self._td.name)
        self.addCleanup(self._td.cleanup)

    def _small_npy(self, name: str) -> Path:
        path = self.tmp / name
        np.save(path, np.zeros((4, 5, 128), dtype=np.float32))
        return path

    def test_sha256_file_matches_hashlib(self) -> None:
        path = self._small_npy("clip.npy")
        expected = hashlib.sha256(path.read_bytes()).hexdigest()
        self.assertEqual(MODULE.sha256_file(path), expected)
        self.assertEqual(len(expected), 64)

    def test_write_manifest_records_full_provenance(self) -> None:
        path = self._small_npy("tessera_2025_sample_0km.npy")
        manifest_path = MODULE.write_manifest(
            path, year=2025, center_e=407500, center_n=4185500,
            half_width_m=400, anchor_targeted=False,
        )
        self.assertEqual(manifest_path, path.with_suffix(".manifest.json"))
        self.assertTrue(manifest_path.exists())
        manifest = json.loads(manifest_path.read_text())

        self.assertEqual(manifest["store_url"], "s3://tessera-embeddings/v1.1/dclimate.icechunk")
        self.assertEqual(manifest["registry"], "https://registry.opendata.aws/tessera/")
        self.assertEqual(manifest["license"], "CC-BY-SA")
        self.assertEqual(manifest["crs"], "EPSG:32616")
        self.assertEqual(manifest["vintage"]["year"], 2025)
        self.assertEqual(manifest["vintage"]["time_index"], 8)
        self.assertEqual(manifest["vintage"]["store_years"], "2017-2025")
        self.assertEqual(manifest["sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertEqual(manifest["size_bytes"], path.stat().st_size)
        self.assertEqual(manifest["access"], "anonymous read-only S3 (no writes, no resource creation)")
        self.assertFalse(manifest["anchor_targeted"])
        bbox = manifest["bbox_utm_16n_approx"]
        self.assertEqual(bbox["easting_min"], 407100)
        self.assertEqual(bbox["easting_max"], 407900)
        self.assertEqual(bbox["northing_min"], 4185100)
        self.assertEqual(bbox["northing_max"], 4185900)

    def test_sample_clip_constants_are_privacy_safe(self) -> None:
        # Rounded to 100 m (general area, not precise).
        self.assertEqual(MODULE.SAMPLE_CENTER_E % 100, 0)
        self.assertEqual(MODULE.SAMPLE_CENTER_N % 100, 0)
        # NOT anchor-targeted: well clear of the anchor constants.
        self.assertNotEqual(MODULE.SAMPLE_CENTER_E, ANCHOR_UTM_E)
        self.assertNotEqual(MODULE.SAMPLE_CENTER_N, ANCHOR_UTM_N)
        self.assertGreater(abs(MODULE.SAMPLE_CENTER_E - ANCHOR_UTM_E), 1000)
        self.assertGreater(abs(MODULE.SAMPLE_CENTER_N - ANCHOR_UTM_N), 1000)
        # Small by design: 800 m x 800 m at 10 m -> 80x80 px -> ~3.3 MB float32 (H, W, 128).
        px = (2 * MODULE.SAMPLE_HALF_WIDTH_M) // 10
        size_mb = px * px * 128 * 4 / 1e6
        self.assertLess(size_mb, 5.0)

    def test_store_and_license_constants(self) -> None:
        self.assertEqual(MODULE.TESSERA_LICENSE, "CC-BY-SA")
        self.assertEqual(MODULE.TESSERA_CRS, "EPSG:32616")
        self.assertEqual(MODULE.TESSERA_STORE_URL,
                         "s3://tessera-embeddings/v1.1/dclimate.icechunk")


@unittest.skipUnless(_HAS_ZARR, "zarr not installed")
class ProxySafeStoreTests(unittest.TestCase):
    """Offline tests for _ProxySafeStore range splitting (no network)."""

    def setUp(self) -> None:
        import asyncio

        self.asyncio = asyncio
        self.payload = bytes(range(256)) * 30000  # 7.68 MB fake chunk

        class FakeInner:
            def __init__(self, outer):
                self.outer = outer
                self.calls = []

            async def get(self, key, prototype, byte_range=None):
                self.calls.append((byte_range.start, byte_range.end))
                assert byte_range.end - byte_range.start <= 2_000_000
                return prototype.buffer.from_bytes(
                    self.outer.payload[byte_range.start:byte_range.end])

            async def get_partial_values(self, prototype, key_ranges):
                return [await self.get(k, prototype, br) for k, br in key_ranges]

            @property
            def supports_listing(self):
                return True

        from zarr.core.buffer import default_buffer_prototype
        self.prototype = default_buffer_prototype()
        self.inner = FakeInner(self)
        self.store = MODULE._ProxySafeStore(self.inner)

    def _run(self, coro):
        return self.asyncio.run(coro)

    def test_big_range_is_split_and_reassembled_in_order(self) -> None:
        from zarr.abc.store import RangeByteRequest

        buf = self._run(
            self.store.get("k", self.prototype,
                           RangeByteRequest(0, len(self.payload))))
        self.assertIsNotNone(buf)
        assert buf is not None
        self.assertEqual(buf.to_bytes(), self.payload)
        self.assertEqual(len(self.inner.calls), 4)  # 7.68MB -> 4 x <=2MB
        # Sub-requests are contiguous and cover the full range in order.
        self.assertEqual(self.inner.calls[0][0], 0)
        self.assertEqual(self.inner.calls[-1][1], len(self.payload))
        for (s1, e1), (s2, e2) in zip(self.inner.calls, self.inner.calls[1:]):
            self.assertEqual(e1, s2)

    def test_small_range_passes_through_unsplit(self) -> None:
        from zarr.abc.store import RangeByteRequest

        buf = self._run(
            self.store.get("k", self.prototype, RangeByteRequest(10, 20)))
        self.assertIsNotNone(buf)
        assert buf is not None
        self.assertEqual(buf.to_bytes(), self.payload[10:20])
        self.assertEqual(len(self.inner.calls), 1)

    def test_get_partial_values_splits_big_ranges(self) -> None:
        from zarr.abc.store import RangeByteRequest

        res = self._run(self.store.get_partial_values(
            self.prototype,
            [("a", RangeByteRequest(0, 5_000_000)),
             ("b", RangeByteRequest(0, 100))]))
        self.assertEqual(len(res), 2)
        assert res[0] is not None and res[1] is not None
        self.assertEqual(res[0].to_bytes(), self.payload[:5_000_000])
        self.assertEqual(res[1].to_bytes(), self.payload[:100])

    def test_store_is_read_only(self) -> None:
        self.assertFalse(self.store.supports_writes)
        self.assertFalse(self.store.supports_deletes)
        with self.assertRaises(NotImplementedError):
            self._run(self.store.set("k", self.prototype.buffer.from_bytes(b"x")))


if __name__ == "__main__":
    unittest.main()
