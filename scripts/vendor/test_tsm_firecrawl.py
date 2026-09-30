"""Offline tests for tsm_firecrawl hardening: SSRF guard, secret redaction,
untrusted envelope, provenance. No network access required."""

import hashlib
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))

import tsm_firecrawl as tf


def _public_addrinfo(host, *args, **kwargs):
    # Resolve IP literals truthfully; map any other hostname to a public IP.
    try:
        import ipaddress as _ip

        return [(2, 1, 6, "", (str(_ip.ip_address(host)), 0))]
    except ValueError:
        return [(2, 1, 6, "", ("93.184.216.34", 0))]


class TestSsrfGuard(unittest.TestCase):
    def test_rejects_loopback(self):
        with self.assertRaises(tf.UnsafeTargetError):
            tf.validate_scrape_url("http://127.0.0.1/")

    def test_rejects_private(self):
        with self.assertRaises(tf.UnsafeTargetError):
            tf.validate_scrape_url("http://10.0.0.1/admin")

    def test_rejects_link_local_metadata(self):
        with self.assertRaises(tf.UnsafeTargetError):
            tf.validate_scrape_url("http://169.254.169.254/latest/meta-data")

    def test_rejects_ipv6_loopback(self):
        with self.assertRaises(tf.UnsafeTargetError):
            tf.validate_scrape_url("http://[::1]/")

    def test_rejects_non_http_scheme(self):
        with self.assertRaises(tf.UnsafeTargetError):
            tf.validate_scrape_url("ftp://example.com/file")

    def test_rejects_file_scheme(self):
        with self.assertRaises(tf.UnsafeTargetError):
            tf.validate_scrape_url("file:///etc/passwd")

    def test_accepts_public_host(self):
        with patch.object(tf.socket, "getaddrinfo", _public_addrinfo):
            out = tf.validate_scrape_url("https://example.com/page")
        self.assertEqual(out, "https://example.com/page")

    def test_redirect_chain_revalidates_hops(self):
        with patch.object(tf.socket, "getaddrinfo", _public_addrinfo):
            final = tf.validate_redirect_chain(
                "https://example.com/a", ["/b", "https://example.com/c"]
            )
        self.assertEqual(final, "https://example.com/c")

    def test_redirect_chain_blocks_private_hop(self):
        with patch.object(tf.socket, "getaddrinfo", _public_addrinfo):
            with self.assertRaises(tf.UnsafeTargetError):
                tf.validate_redirect_chain(
                    "https://example.com/a", ["http://127.0.0.1/evil"]
                )

    def test_redirect_chain_too_long(self):
        with patch.object(tf.socket, "getaddrinfo", _public_addrinfo):
            with self.assertRaises(tf.UnsafeTargetError):
                tf.validate_redirect_chain(
                    "https://example.com/a", ["/x"] * (tf.MAX_REDIRECTS + 1)
                )


class TestRedaction(unittest.TestCase):
    def test_redacts_api_key_assignment(self):
        md = 'config: api_key = "sk-live-abcdefghijklmnop"'
        out = tf.redact_secrets(md)
        self.assertIn("api_key = [REDACTED]", out)
        self.assertNotIn("sk-live", out)

    def test_redacts_aws_key(self):
        out = tf.redact_secrets("key AKIAIOSFODNN7EXAMPLE here")
        self.assertNotIn("AKIAIOSFODNN7EXAMPLE", out)
        self.assertIn("[REDACTED]", out)

    def test_redacts_github_pat(self):
        out = tf.redact_secrets("token ghp_" + "a" * 36)
        self.assertNotIn("ghp_", out)

    def test_leaves_benign_text(self):
        md = "# Flood Data\n\nThe river is at 18.4 ft."
        self.assertEqual(tf.redact_secrets(md), md)


class TestDocumentEnvelope(unittest.TestCase):
    def test_untrusted_by_default(self):
        doc = tf.ScrapedDocument(url="https://example.com", markdown="hello")
        self.assertEqual(doc.trust_level, "untrusted")
        self.assertTrue(doc.instructions_disabled)

    def test_provenance_stamped(self):
        doc = tf.ScrapedDocument(url="https://example.com", markdown="hello")
        self.assertEqual(
            doc.provenance["content_sha256"],
            hashlib.sha256(b"hello").hexdigest(),
        )
        self.assertEqual(doc.provenance["provider"], "firecrawl-selfhost")
        self.assertEqual(doc.provenance["sourceType"], "web")


if __name__ == "__main__":
    unittest.main()
