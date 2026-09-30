# TSM Oracle Cloud deployment — login-free / gauge-independent

This profile runs the TSM API and Caddy only. It does not require Keycloak,
OIDC, river-gauge polling, or an interactive login.

## Runtime

- API: TSM Node server + UACF runtime.
- Caddy: HTTPS termination.
- Static/cached authoritative datasets and deterministic simulations.
- Optional UACF provider credentials are environment/OCI-secret references.
- TSM_PUBLIC_OPERATOR_MODE is explicit and anonymous; do not expose destructive
  infrastructure controls through this mode.

## Automatic deployment

The GitHub workflow requires these repository secrets:

- ORACLE_SSH_HOST
- ORACLE_SSH_USER
- ORACLE_SSH_KEY

The workflow creates deploy/oracle/.env on the VM if it does not exist and
generates TSM_SESSION_SECRET and UACF_MASTER_KEY locally on the VM when absent.
Secret values are never printed or committed.

On first manual deployment:

```bash
cd /opt/tsm/tree/deploy/oracle
cp .env.example .env
openssl rand -base64 48
# put the generated value into TSM_SESSION_SECRET and UACF_MASTER_KEY
docker compose --env-file .env up -d --build
curl -fsS https://<API_HOSTNAME>/ready
```

## No live river gauges

The Oracle runtime does not call USGS/NOAA live-observation endpoints.
Historical observations may remain as explicitly labeled evidence; they are
not runtime telemetry.

## OCI networking

Open TCP 80/443 in the VCN security list. Restrict SSH/22 to your admin IP.
Use OCI Vault for additional provider credentials when external AI/web
providers are enabled.

## Verification

```bash
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 api
curl -fsS https://<API_HOSTNAME>/ready
```
