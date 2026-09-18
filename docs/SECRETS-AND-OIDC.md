# GitHub Actions Secrets and OIDC

## Policy

TSM does **not** require a FEMA API key for the public NFHL service currently configured in the repository. Do not invent or create `FEMA_NFHL_API_KEY` merely to satisfy CI.

For credentials that genuinely are required:

1. Prefer GitHub OIDC federation for cloud/deployment credentials.
2. Prefer short-lived credentials issued by an external secret manager.
3. Use GitHub repository/environment secrets only when the target service cannot use OIDC.
4. Never commit secret values, `.env` files containing credentials, PATs, signing keys, or service passwords.
5. Never create a workflow that uses a long-lived repository-admin PAT solely to rotate other repository secrets. That creates a bootstrap secret that itself requires rotation and grants excessive authority.

## CLI provisioning

GitHub CLI encrypts secret values locally before sending them to GitHub. The supported interface is:

```bash
gh secret set SECRET_NAME --repo ATphobia22/Tri-State-Systems-Manager
```

For a file:

```gh
gh secret set SECRET_NAME --repo ATphobia22/Tri-State-Systems-Manager < secret-value.txt
```

The repository helper `scripts/ops/set-github-secret.sh` validates the name and accepts a value file or stdin.

For bulk dotenv import, use `gh secret set -f <file>` only with a deliberately prepared file containing **secrets only**; never point it at a normal application `.env` that contains public configuration.

## OIDC

Cloud credentials should use:

```yaml
permissions:
  contents: read
  id-token: write
```

The cloud-side trust policy must restrict the repository, branch/tag, and/or deployment environment. GitHub explicitly recommends defining conditions so an untrusted repository cannot obtain cloud credentials.

TSM's Databricks integration already follows this pattern and explicitly forbids long-lived Databricks tokens.

## Rotation

GitHub Actions cannot retrieve an existing secret's plaintext value. Rotation therefore requires a new value from the credential issuer/secret manager and an authorized update operation.

For external secret managers, use GitHub OIDC to obtain a short-lived access token at runtime and fetch the secret into process memory. Do not write it to artifacts, caches, logs, or generated source.

## Debugging

When a workflow fails because a required credential/configuration is absent:

- distinguish **repository variables** (public configuration) from **secrets** (sensitive credentials);
- validate presence without printing values;
- use environment-level secrets for production deployments where protection rules are appropriate;
- enable GitHub runner debug logging only temporarily;
- upload sanitized logs/screenshots as artifacts for failed E2E runs.

A missing secret should produce a deterministic, actionable failure—not a fabricated fallback credential or synthetic production data.
