import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[2] / 'integrations/managed_gateway.py'


class GatewayTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('managed_gateway', PATH)
        self.gateway = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.gateway)

    def test_missing_token_blocks_network(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(self.gateway, 'read_json') as read:
            with self.assertRaises(self.gateway.GatewayError):
                self.gateway.snapshot()
            read.assert_not_called()

    def test_snapshot_limits_response_and_checks_identity(self):
        with patch.dict(os.environ, {'TSM_GITHUB_TOKEN': 'github-test', 'TSM_DRIVE_TOKEN': 'drive-test'}, clear=True):
            with patch.object(self.gateway, 'read_json', side_effect=[{'sha': 'a'*40, 'secret': 'never'}, {'id': self.gateway.FOLDER_ID, 'mimeType': 'application/vnd.google-apps.folder', 'name': 'private'}]) as read:
                result = self.gateway.snapshot()
                self.assertEqual(result['main_sha'], 'a'*40)
                self.assertEqual(result['drive_folder_id'], self.gateway.FOLDER_ID)
                self.assertNotIn('never', json.dumps(result))
                self.assertNotIn('private', json.dumps(result))
                self.assertEqual(read.call_count, 2)
            with patch.object(self.gateway, 'read_json', side_effect=[{'sha': 'a'*40}, {'id': 'wrong', 'mimeType': 'application/vnd.google-apps.folder'}]):
                with self.assertRaises(self.gateway.GatewayError):
                    self.gateway.snapshot()

    def test_redirect_is_rejected(self):
        with self.assertRaises(self.gateway.GatewayError):
            self.gateway.NoRedirect().redirect_request(None, None, 302, 'redirect', {}, 'https://example.com')

    def test_no_token_in_error(self):
        with patch.object(self.gateway, 'build_opener', side_effect=OSError('secret-token')):
            with self.assertRaises(self.gateway.GatewayError) as err:
                self.gateway.read_json(self.gateway.GITHUB_URL, 'secret-token')
            self.assertNotIn('secret-token', str(err.exception))
