# Government Engineering Quick Start — Tri-State Systems Manager

**Purpose:** Reproducible setup and validation for government engineers, GIS analysts, reviewers, and authorized operators.

**Repository:** https://github.com/ATphobia22/Tri-State-Systems-Manager  
**Console:** `tsm-console/`  
**Runtime:** Node.js >= 22  
**Primary branch:** `main`

## 1. Authority and safety rules

1. **Human authority remains final.** TSM is decision support; it does not issue FEMA LOMA/LOMR/CLOMR, No-Rise, FARA, floodplain permits, or other regulatory determinations.
2. **No auto-filing.** Regulatory submissions require the responsible agency and/or licensed professional process.
3. **Evidence is typed.** Observation, calculation, simulation, evidence artifact, and regulatory determination are separate states.
4. **Datum is explicit.** Raw gage height remains in the source product's datum. It is not silently labeled NAVD88.
5. **Credentials are minimized.** Do not commit or browser-expose provider secrets.
6. **AI is governed.** ADR-006 S1 is the default; S2 requires prescribed tools and a human gate; S3 is deferred.

## 2. Reproducible local setup

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager/tsm-console
npm ci --no-audit --no-fund
```

Verify the source tree before development:

```bash
npm run check:integrity
npm run check:parse
npm run check:type
```

Build and preview:

```bash
npm run build
npm run preview
```

Development server:

```bash
npm run dev
```

Optional token proxy:

```bash
npm run proxy
```

## 3. Full engineering validation

Use the same fail-closed sequence represented by CI:

```bash
npm run ci:full
```

This validates repository integrity, capability registration, workflow boundaries, artifact contracts, quantum isolation, shell safety, site consistency, parsing, TypeScript, geospatial contracts, production build, and test suites.

Do not disable a failing gate to make CI green.

## 4. Identity configuration

The browser client uses Authorization Code + PKCE with a public OIDC client. Keycloak is the supported open-source reference deployment.

Example development environment:

```text
VITE_IDP_PROVIDER=keycloak
VITE_IDP_AUTHORITY=http://localhost:8080/realms/tsm
VITE_IDP_CLIENT_ID=tsm-console
VITE_IDP_REDIRECT_URI=http://localhost:5173/login/callback
VITE_IDP_SCOPES=openid profile email
```

Production identity requirements:

- TLS enabled;
- dedicated realm/tenant configuration as appropriate;
- public client with PKCE `S256`;
- organization-approved roles and policies;
- no browser-side client secret;
- no provider credentials committed to source control.

## 5. Credential policy

Never commit API keys, bearer tokens, passwords, private keys, client secrets, or secret-bearing `.env` files.

If a credential was committed, assume compromise. Revoke/rotate it with the issuing provider and follow the organization's approved history-remediation procedure.

The core build and validation path must remain usable without paid AI or identity-provider APIs.

## 6. Open-source reference infrastructure

| Capability | Reference | Credential posture |
|---|---|---|
| OIDC / IAM | Keycloak | Public browser client + PKCE |
| Local LLM | Ollama | Local; no provider API key |
| Portable inference | llama.cpp | Local; no provider API key |
| Browser mapping | MapLibre GL JS | No Mapbox token required |

Official projects:

- https://github.com/keycloak/keycloak
- https://github.com/ollama/ollama
- https://github.com/ggml-org/llama.cpp
- https://github.com/maplibre/maplibre-gl-js

## 7. Bonebank engineering reference

| Item | Current project reference |
|---|---|
| Address | 13101 Bonebank Road, Point Township, Posey County, Indiana |
| APN | 65-19-08-100-008.001-010 |
| FIRM panel SSOT | **18129C0300C**; NFHL REST verified in the current repository contract |
| FIRM effective date | 2014-11-05 |
| BFE | 375.0 ft NAVD88 |
| LAG | 377.2 ft NAVD88 |
| LAG − BFE | +2.2 ft |
| FFE | 382.5 ft NAVD88 |
| Horizontal CRS | EPSG:2966 — NAD83 / Indiana West (ftUS) |
| Vertical datum | NAVD88 for the site reference elevations |

These are project engineering inputs. They do not override a controlling agency product or professional determination.

## 8. Hydrologic datum procedure

For an external gage:

1. identify the station and product;
2. retain the source gage datum;
3. retain observation timestamp and units;
4. obtain a validated product-matched datum conversion;
5. derive NAVD88 WSE only when conversion metadata is complete;
6. preserve the source and derived records separately;
7. require professional review before regulatory interpretation.

Conceptual calculation:

```text
WSE_NAVD88 = source_gage_height + validated_gage_zero_NAVD88
```

The canonical application conversion contract is `tsm-console/src/lib/gage-datums.ts`.

## 9. Primary repository references

- `README.md` — complete government-engineering overview
- `docs/REPOSITORY-STRUCTURE.md` — directory ownership and cleanup rules
- `docs/CHANGE-CONTROL.md` — engineering change classes
- `docs/ADR-006-Agentic-Autonomy-Ladder-and-Tool-Scope-Policy.md` — AI/agent policy
- `docs/NFHL-REST-AND-USGS-WATER-TOOLS.md` — FEMA/USGS access guidance
- `tsm-console/src/lib/firm-panel-ssot.ts` — FEMA panel SSOT
- `data/schemas/tsm-site-constants-13101-bonebank.json` — site contract
- `SECURITY.md` — security reporting and policy

## 10. Troubleshooting

### CI fails

Find the first failing gate, reproduce its npm command locally, and classify the failure as code, dependency, repository, data-contract, or platform configuration. Do not weaken validation gates.

### Gage values disagree

Check station identity, product, timestamp, source datum, target datum, conversion source, units, and whether the value is an observation or a derived WSE.

### FEMA panels/products disagree

Preserve the conflicting source records and escalate to the responsible floodplain professional/authority. Do not silently replace one source with another.

### Local and CI builds differ

Compare Node/npm versions, `package-lock.json`, working directory, environment variables, and exact commit SHA. The canonical installation path is `npm ci`.
