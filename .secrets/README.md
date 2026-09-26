# Local Secrets

This directory is intentionally ignored by Git.

- Store credentials, private keys, tokens, and other secret material only in a local secret manager or this ignored directory.
- Never commit real secrets, API keys, passwords, private certificates, or access tokens.
- Public evidence hashes and provenance manifests belong under `evidence/`, not here.
- CI secrets should be configured in GitHub Actions repository/environment secrets.

The tracked `.gitignore` entry keeps this directory's contents out of commits while allowing this documentation file to explain the boundary.
