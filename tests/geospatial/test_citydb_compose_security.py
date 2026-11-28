import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = ROOT / 'auto-3d-city-builder/docker/docker-compose.yml'


class CityDBComposeSecurityTests(unittest.TestCase):
    def setUp(self):
        self.text = COMPOSE.read_text()

    def test_database_is_digest_pinned(self):
        self.assertRegex(self.text, r'image: ghcr\.io/3dcitydb/3dcitydb-pg:15-3\.5-5\.1\.4@sha256:[0-9a-f]{64}\b')

    def test_no_latest_tags(self):
        self.assertNotRegex(self.text, r'(?m)^\s*image:.*latest\b')

    def test_database_password_has_no_default(self):
        self.assertIn('${CITYDB_PASSWORD:?', self.text)
        self.assertNotIn('changeMe', self.text)

    def test_ports_are_loopback_only(self):
        ports = re.findall(r'(?m)^\s*- "([^"\n]+:\d+)"\s*$', self.text)
        self.assertEqual(sorted(ports), ['127.0.0.1:5432:5432', '127.0.0.1:8080:8000'])

    def test_proj_network_disabled(self):
        self.assertIn('PROJ_NETWORK: "OFF"', self.text)


if __name__ == '__main__':
    unittest.main()
