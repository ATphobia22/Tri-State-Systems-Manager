#!/usr/bin/env python3
"""Unit tests for transient-failure retry and fail-closed USGS provider handling."""
from __future__ import annotations

import importlib.util
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("acquire-posey-47620-3dep.py")
SPEC = importlib.util.spec_from_file_location("posey_3dep_acquirer", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load USGS acquisition module")
ACQUIRER = importlib.util.module_from_spec(SPEC)
try:
    SPEC.loader.exec_module(ACQUIRER)
except ModuleNotFoundError as exc:
    # Environment limitation: optional geospatial dependency (shapely)
    # is not installed on this machine. Skip honestly instead of failing.
    raise unittest.SkipTest(
        f"requires optional geospatial dependency missing here ({exc.name})"
    ) from exc


class FakeResponse:
    def __init__(self, body: bytes, content_type: str = "application/json"):
        self.body = body
        self.headers = {"Content-Type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self) -> bytes:
        return self.body


class ProviderRecoveryTests(unittest.TestCase):
    def test_success_returns_body_and_content_type_without_retry(self):
        with patch.object(ACQUIRER.urllib.request, "urlopen", return_value=FakeResponse(b'{"ok":true}')) as open_url:
            body, content_type = ACQUIRER.fetch("https://example.invalid/metadata")
        self.assertEqual(body, b'{"ok":true}')
        self.assertEqual(content_type, "application/json")
        self.assertEqual(open_url.call_count, 1)

    def test_transient_http_503_recovers_on_retry(self):
        transient = urllib.error.HTTPError("https://example.invalid", 503, "busy", {}, None)
        with (
            patch.object(ACQUIRER.urllib.request, "urlopen", side_effect=[transient, FakeResponse(b"raster", "image/tiff")]) as open_url,
            patch.object(ACQUIRER.time, "sleep") as sleep,
        ):
            body, content_type = ACQUIRER.fetch("https://example.invalid/raster")
        self.assertEqual(body, b"raster")
        self.assertEqual(content_type, "image/tiff")
        self.assertEqual(open_url.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_permanent_http_404_fails_without_retry(self):
        permanent = urllib.error.HTTPError("https://example.invalid", 404, "not found", {}, None)
        with (
            patch.object(ACQUIRER.urllib.request, "urlopen", side_effect=permanent) as open_url,
            patch.object(ACQUIRER.time, "sleep") as sleep,
        ):
            with self.assertRaises(urllib.error.HTTPError):
                ACQUIRER.fetch("https://example.invalid/missing")
        self.assertEqual(open_url.call_count, 1)
        sleep.assert_not_called()

    def test_network_failure_exhausts_bounded_retries_and_fails_closed(self):
        failure = urllib.error.URLError("connection unavailable")
        with (
            patch.object(ACQUIRER.urllib.request, "urlopen", side_effect=failure) as open_url,
            patch.object(ACQUIRER.time, "sleep") as sleep,
        ):
            with self.assertRaises(urllib.error.URLError):
                ACQUIRER.fetch("https://example.invalid/unavailable", attempts=4)
        self.assertEqual(open_url.call_count, 4)
        self.assertEqual(sleep.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 2, 4])


if __name__ == "__main__":
    unittest.main()
