# Government / Agency Quick Start — Tri-State Systems Manager

**Repository:** https://github.com/ATphobia22/Tri-State-Systems-Manager  
**Console path:** `tsm-console/`  
**Node:** >= 22  
**Purpose:** Public-interest evidence, maps, and digital twin for Posey County / Tri-State River Valley.

## Principles

1. **Human authority remains final** — this system informs; it does not issue LOMA/LOMR or grant awards.
2. **No auto-filing** — FEMA Case 26-05-2022A is tracked only.
3. **Open source** — Apache-2.0; reproducible builds use the committed `package-lock.json` with `npm ci`.
4. **Credential minimization** — the repository contains no provider API keys or proprietary identity-provider secrets.
5. **Local-first AI** — AI integrations must use local/open-source runtimes unless an explicitly governed external provider is approved.

## Open-source infrastructure replacements

| Capability | Replacement | License / model | Credentials required |
|---|---|---|---|
| OIDC / IAM / SSO | Keycloak | Apache-2.0 | No application client secret; use public client + PKCE |
| Local LLM runtime | Ollama | MIT | No API key for local runtime |
| Portable LLM inference | llama.cpp | MIT | No API key for local runtime |
| Browser mapping | MapLibre GL JS | BSD-3-Clause | No Mapbox token |

Official projects:

- https://github.com/keycloak/keycloak
- https://github.com/ollama/ollama
- https://github.com/ggml-org/llama.cpp
- https://github.com/maplibre/maplibre-gl-js

## One-command local run

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager/tsm-console
npm ci
npm run check:parse
npm run check:type
npm run build
npm run preview
# open http://localhost:4173
```

### Development mode

```bash
npm run dev          # Vite on :5173
npm run proxy        # optional API :8787
```

### Keycloak development identity provider

The console is configured for a self-hosted Keycloak realm when `VITE_IDP_PROVIDER=keycloak`.

Keycloak exposes standard OIDC discovery, authorization, token, userinfo, logout, and certificate endpoints. The browser client uses Authorization Code + PKCE and does not require a client secret.

Example environment:

```bash
VITE_IDP_PROVIDER=keycloak
VITE_IDP_AUTHORITY=http://localhost:8080/realms/tsm
VITE_IDP_CLIENT_ID=tsm-console
VITE_IDP_REDIRECT_URI=http://localhost:5173/login/callback
VITE_IDP_SCOPES="openid profile email"
```

For production, run Keycloak behind TLS, create a dedicated realm, register `tsm-console` as a public client, enable PKCE with `S256`, and apply organization-specific roles and policies.

## What builds without credentials

| Command | Requires provider secrets? |
|---------|----------------------------|
| `npm run check:parse` | No |
| `npm run check:type` | No |
| `npm run build` | No |
| `npm run preview` | No |
| `npm run scan:loma` | No (uses local catalog JSON) |
| Keycloak OIDC | No application client secret; Keycloak itself must be deployed/configured |
| Local Ollama / llama.cpp | No API key |

## Credential security policy

Do **not** commit API keys, client secrets, bearer tokens, passwords, private keys, or `.env` files.

If a credential has ever been committed, assume it is compromised: revoke/rotate it at the issuing service and remove it from repository history using an appropriate history-rewrite procedure.

The repository's runtime defaults must remain usable without paid AI or identity-provider APIs.

## Key operational facts (Bonebank node)

| Item | Value |
|------|------:|
| Address | 13101 Bonebank Road, Point Twp, Posey Co, IN |
| FIRM panel | **18129C0215C** (eff. 2014-11-05) |
| BFE | 375.0 ft NAVD88 |
| LAG | 377.2 ft NAVD88 |
| Δz | +2.2 ft |
| Active LOMC | **26-05-2022A** (Application ID 5918599025038) — IN PROGRESS |

## Support contacts (external)

- FEMA Map Info: 1-877-FEMA-MAP  
- MSC: https://msc.fema.gov  

## License / contribution

The repository is licensed under Apache-2.0; see `LICENSE`. Security reporting and dependency policy are documented in `SECURITY.md`.
