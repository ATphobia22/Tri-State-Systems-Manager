# TSM production API on Oracle Cloud Always Free — $0/month

This deploys the full production stack on a single Always Free VM:

- **api** — the TSM Node server (same Dockerfile as the Coolify setup)
- **postgres** — Keycloak's database (persistent volume)
- **keycloak** — the OIDC login server the API requires at boot
- **caddy** — automatic Let's Encrypt HTTPS for both public hostnames

No Coolify Cloud subscription needed. The GitHub workflow
`.github/workflows/deploy-oracle.yml` redeploys on every push to `main`.

## Part 1 — Oracle account + VM (only you can do this)

About 15 minutes in the Oracle Cloud console (cloud.oracle.com):

1. **Sign up** for the Always Free tier. Oracle needs an email, phone
   verification, and a real credit/debit card (a small verification hold
   only — prepaid/virtual cards are rejected).
2. **Create the instance**: Compute → Instances → Create instance.
   - Name: `tsm-api`
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM) → set **2 OCPUs / 12 GB RAM**.
     Provision at *exactly* the free cap — Oracle halved this allowance in
     June 2026 and deleted over-limit instances in August 2026. Verify the
     numbers shown in the console before creating.
   - Networking: create a new VCN, **assign a public IPv4 address**.
   - Paste your SSH **public** key. Boot volume ≤ 200 GB (free total).
   - If you get "Out of host capacity": switch availability domain and
     retry off-peak — it usually succeeds within hours.
3. **Open the web ports**: in the VCN's Security List add ingress rules for
   TCP **80** and **443** from `0.0.0.0/0` (SSH port 22 is open by default).
4. *Recommended, do once*: upgrade the tenancy to Pay As You Go (stays $0
   inside Always Free limits; moves you out of the leftover-capacity pool)
   and set a budget alert at $1–$5.

## Part 2 — First boot on the VM (one SSH session, ~10 min)

```bash
ssh -i <your-key> ubuntu@<VM_PUBLIC_IP>

# get the code
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git /opt/tsm/tree
cd /opt/tsm/tree/deploy/oracle

# install Docker, open firewall, prepare /opt/tsm
bash bootstrap.sh
# NOTE: log out and back in once so the docker group applies, then:

# create secrets (run each openssl line, paste the output into .env)
cp .env.example .env
openssl rand -base64 24   # -> KEYCLOAK_ADMIN_PASSWORD
openssl rand -base64 32   # -> OIDC_CLIENT_SECRET
openssl rand -base64 48   # -> TSM_SESSION_SECRET (min 32 chars)
openssl rand -base64 24   # -> POSTGRES_PASSWORD
```

Edit `.env`: replace `203-0-113-51` in the four hostname/URL lines with your
VM's public IP (dots become dashes, e.g. IP `129.146.7.22` →
`api.129-146-7-22.sslip.io`). sslip.io is free DNS that resolves to your IP,
so Let's Encrypt can issue real certificates with no domain purchase.
(Own a domain? Put `api.yourdomain.com` / `keycloak.yourdomain.com` here
instead and point their A records at the VM.)

```bash
# first deploy (SOURCE_COMMIT = the git SHA you cloned)
cd /opt/tsm/tree/deploy/oracle
SOURCE_COMMIT=$(git -C /opt/tsm/tree rev-parse HEAD) \
  docker compose --env-file .env up -d --build

# verify (Keycloak takes 1-2 min on first boot; the API restarts until it is)
curl -s https://<API_HOSTNAME>/ready
# expect: "build_sha":"<sha>", "auth_ready":true, "required_internal_dependencies":{"...","oidc":true}
```

## Part 3 — GitHub wiring (2 min, repo Settings)

Secrets (Settings → Secrets and variables → Actions → Secrets):

- `ORACLE_SSH_HOST` — the VM's public IP
- `ORACLE_SSH_USER` — `ubuntu`
- `ORACLE_SSH_KEY` — the **private** key matching the VM's authorized key

Variable (same page → Variables tab):

- `TSM_API_BASE_URL` = `https://<API_HOSTNAME>` (no trailing slash)

That's it. Every push to `main` now rebuilds the exact commit on the VM,
and the Pages workflow's API-readiness gate checks that VM's `/ready`.

## Notes

- The API **crash-restarts until Keycloak is healthy** — that is by design
  (`bootstrapOidc` retries ~3 min, then the container restarts). After the
  first boot it settles.
- Logs: `docker compose --env-file .env logs -f api` (or `keycloak`).
- Backups: Postgres lives in the `pgdata` volume; snapshot it before
  upgrades (`docker compose exec postgres pg_dump -U keycloak keycloak > backup.sql`).
- To move off sslip.io later: change the four hostname/URL lines in `.env`
  and redeploy — Caddy reissues certificates automatically.
