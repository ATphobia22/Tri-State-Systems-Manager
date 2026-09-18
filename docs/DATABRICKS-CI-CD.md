# Databricks Lakehouse CI/CD Contract

TSM does not store a Databricks PAT or client secret in GitHub. The production workflow uses **GitHub Actions OIDC workload identity federation**, which Databricks documents as the preferred mechanism for automated workloads.

## Required GitHub repository configuration

Create a GitHub Environment named `prod` and add these **environment variables**:

| Variable | Purpose |
|---|---|
| `TSM_DATABRICKS_ENABLED` | Set to `true` only after federation and bundle validation are complete. |
| `DATABRICKS_HOST` | HTTPS workspace URL. |
| `DATABRICKS_CLIENT_ID` | Databricks service-principal application ID. |

No `DATABRICKS_TOKEN` or client secret is required.

## Required Databricks configuration

Create a service principal and GitHub Actions federation policy matching:

- issuer: `https://token.actions.githubusercontent.com`
- subject: `repo:ATphobia22/Tri-State-Systems-Manager:environment:prod`
- audience: the Databricks account audience configured by the account administrator

Grant the service principal only the workspace/resource permissions required by the eventual lakehouse worker bundle.

## Deployment gate

The workflow is deliberately **disabled until `TSM_DATABRICKS_ENABLED=true`**. This prevents a partially configured federation policy from becoming a production deployment failure on every push to `main`.

The workflow downloads Databricks CLI v1.17.0 and verifies its SHA-256 before installation. Databricks' current documentation recommends GitHub OIDC federation and environment-scoped `DATABRICKS_HOST` / `DATABRICKS_CLIENT_ID` bindings.

## Lakehouse worker boundary

The repository currently has no verified Databricks workspace, catalog, schema, job ID, or worker deployment target. Those values must not be fabricated. Once the target workspace and worker contract are supplied, add the bundle under `databricks.yml` and `ops/databricks/`, then enable the workflow.

This boundary is intentional: the TSM repository may define and validate deployment infrastructure, but it must not invent a cloud tenant, catalog, secret scope, or production dataset.

## References

- Databricks GitHub Actions CI/CD: https://docs.databricks.com/aws/en/dev-tools/databricks-apps/cicd-github-actions
- Databricks workload identity federation: https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation-provider
