"""Private operator metadata probe; never include in anonymous web bundles."""
import json
import os
import re
import sys
from urllib.request import Request, HTTPRedirectHandler, build_opener

GITHUB_URL = 'https://api.github.com/repos/ATphobia22/Tri-State-Systems-Manager/commits/main'
FOLDER_ID = '1UQiTJ9DvK-wnwJZ3YyPph5zl-_VCkqj-'
DRIVE_URL = f'https://www.googleapis.com/drive/v3/files/{FOLDER_ID}?fields=id,mimeType&supportsAllDrives=true'
MAX_BYTES = 2 * 1024 * 1024


class GatewayError(RuntimeError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise GatewayError('Provider redirects are forbidden')


def read_json(url, token):
    if url not in (GITHUB_URL, DRIVE_URL):
        raise GatewayError('Endpoint is not approved')
    try:
        req = Request(url, headers={'Authorization': f'Bearer {token}',
                                   'Accept': 'application/json', 'User-Agent': 'TSM-managed-gateway/1'})
        with build_opener(NoRedirect()).open(req, timeout=20) as response:
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise GatewayError('Provider response exceeds limit')
        obj = json.loads(raw)
        if not isinstance(obj, dict):
            raise GatewayError('Unexpected provider response')
        return obj
    except Exception:
        raise GatewayError('Provider request failed or response invalid') from None


def snapshot():
    github = os.environ.get('TSM_GITHUB_TOKEN')
    drive = os.environ.get('TSM_DRIVE_TOKEN')
    if not github or not drive:
        raise GatewayError('Both operator access tokens are required')
    sha = read_json(GITHUB_URL, github).get('sha')
    if not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise GatewayError('Invalid GitHub commit identity')
    folder = read_json(DRIVE_URL, drive)
    if folder.get('id') != FOLDER_ID or folder.get('mimeType') != 'application/vnd.google-apps.folder':
        raise GatewayError('Drive folder identity mismatch')
    return {'main_sha': sha, 'drive_folder_id': FOLDER_ID, 'mode': 'metadata-read-only'}


if __name__ == '__main__':
    try:
        print(json.dumps(snapshot(), sort_keys=True))
    except GatewayError as exc:
        print(f'BLOCKED: {exc}', file=sys.stderr)
        sys.exit(2)
