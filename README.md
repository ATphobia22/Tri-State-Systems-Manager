# Tri-State Systems Manager (TSM)

**Public-interest engineering decision-support and evidence platform for the Ohio–Wabash Tri-State River Valley**  
**Anchor engineering node:** Point Township, Posey County, Indiana 47620  
**License:** Apache-2.0  
**Repository status:** `main` is the long-lived source of truth

> **Governing principle:** Technology informs people; it does not silently govern people. Human authority remains final.

TSM is designed for government engineers, GIS professionals, emergency-management personnel, planners, researchers, and authorized community partners who need a reproducible way to inspect evidence, visualize spatial conditions, compare engineering quantities, and document uncertainty.

**TSM is not a regulatory authority.** It does not issue FEMA LOMA/LOMR/CLOMR determinations, No-Rise determinations, Indiana FARA approvals, floodplain permits, or other agency decisions. Formal regulatory submissions and sealed engineering products remain subject to the applicable agency and licensed-professional processes.

---

## 1. Operating doctrine

TSM follows six engineering controls:

1. **Evidence before inference** — source observations remain distinguishable from derived calculations and simulations.
2. **Explicit datum and units** — horizontal CRS, vertical datum, units, and transformation method travel with derived data.
3. **Fail closed** — missing or contradictory authority metadata prevents unsafe interpretation.
4. **Human-gated governance** — software and AI do not silently exercise regulatory authority.
5. **Least privilege** — browser applications do not receive proprietary provider secrets.
6. **Reproducibility** — dependency resolution, validation commands, schemas, and source provenance are version controlled.

See `docs/REPOSITORY-STRUCTURE.md` and `docs/CHANGE-CONTROL.md` for repository and change-control requirements.

---

## 2. System architecture

TSM uses the four-plane architecture defined by ADR-005.

| Plane | Engineering responsibility | Authority boundary |
|---|---|---|
| **Evidence & Data Governance** | Ingestion, provenance, hashing, evidence artifacts, source status | Human-gated append; no silent regulatory mutation |
| **Scientific & Simulation** | Hydrology/hydraulics, geospatial processing, uncertainty, digital-twin simulation | Calculations/simulations are not automatically regulatory determinations |
| **Governance & Decision** | Jurisdiction rules, authority registry, review gates, citations | Human authority remains final |
| **Public Experience** | React console, maps, accessible displays, engineering visualization | Presentation only; visualization is not evidence by itself |

### Agentic and AI boundary

ADR-006 defines the autonomy ladder:

- **S1:** no agency — default operating mode.
- **S2:** prescribed tools with an explicit human gate.
- **S3:** deferred; not an approved autonomous governance mode.

AI output is advisory unless a separately authorized human process accepts it. AI must not silently write regulatory state, file government instruments, or bypass evidence controls.

### Quantum boundary

Quantum and quantum-inspired research remains experimental. The repository's quantum boundary validator prevents experimental code from becoming an implicit production/regulatory dependency.

---

## 3. Engineering data hierarchy

TSM distinguishes the following states:

| State | Meaning | Regulatory status |
|---|---|---|
| **Observation** | Direct external measurement/telemetry | Evidence input only |
| **Calculation** | Deterministic transformation of documented inputs | Engineering analysis |
| **Simulation** | Model output under stated assumptions | Engineering/research analysis |
| **Evidence artifact** | Versioned, provenance-linked record | Reviewable evidence |
| **Regulatory determination** | Decision by the responsible authority | Outside TSM automation; human/agency process |

A map-service identify result is not a sealed LOMA. A live river stage is not a structure-inundation determination. A digital-twin visualization is not a survey.

---

## 4. Hydrologic and geodetic controls

### Vertical datum rule

**Raw gage height is not NAVD88.** USGS parameter `00065` and NWS observed stage are source-product measurements and must retain their source datum. A derived NAVD88 water-surface elevation requires an explicit, product-matched gage-zero conversion.

Conceptually:

```text
WSE_NAVD88 = source_gage_height + validated_gage_zero_NAVD88
```

The conversion must preserve source station, observation time, source datum, target datum, conversion source, units, and validation status.

### Bonebank engineering reference values

The repository currently uses these project reference values; they are engineering inputs, not an independent regulatory determination:

| Quantity | Reference value | Datum / unit |
|---|---:|---|
| BFE | 375.0 ft | NAVD88 |
| LAG | 377.2 ft | NAVD88 |
| LAG − BFE | +2.2 ft | ft |
| FFE | 382.5 ft | NAVD88 |
| Berm crest | 379.8 ft | NAVD88 |
| Horizontal CRS | EPSG:2966 | NAD83 / Indiana West (ftUS) |

The canonical site-contract file is `data/schemas/tsm-site-constants-13101-bonebank.json`. Any discrepancy between project inputs and an agency product must be surfaced and reconciled by the responsible engineer; software must not silently choose a regulatory value.

### FEMA panel reference

The current TSM FIRM SSOT records **18129C0300C** as the NFHL-identified canonical panel for the Bonebank lookup coordinates, with an effective date of 2014-11-05. See `tsm-console/src/lib/firm-panel-ssot.ts`.

The NFHL digital representation does not replace the controlling FEMA FIRM/FIS hierarchy for formal regulatory use.

---

## 5. Authoritative and high-value external sources

TSM is designed around primary-source government data wherever practical.

| Source | Primary use | Local contract / guide |
|---|---|---|
| **FEMA NFHL / MSC / FIRM / FIS / LOMC** | Flood hazard mapping, BFEs, panels, regulatory products | `docs/NFHL-REST-AND-USGS-WATER-TOOLS.md` |
| **USGS NWIS** | Streamgage observations and metadata | `docs/INFIP-AND-USGS-GAUGES.md` |
| **NOAA / NWS NWPS** | Forecast/observed stage and datum metadata | `tsm-console/src/lib/gage-datums.ts` |
| **USACE Louisville District** | Navigation, hydraulic and river-system context | Project source registry |
| **Indiana DNR Division of Water** | State floodplain/floodway requirements and INFIP/BAFM | Project authority registry |
| **Indiana GIO / 3DEP** | LiDAR, elevation, orthophotography and geospatial inputs | `tools/ortho/`, geospatial validation scripts |
| **Posey County** | Local ordinances and administration | Project authority registry |
| **NIST** | AI risk management and zero-trust reference controls | ADR/governance documentation |

Source URLs and access procedures are maintained in the repository's source guides rather than embedded as undocumented assumptions in application logic.

---

## 6. Canonical repository map

```text
.
├── .github/workflows/        # CI/CD and automated policy enforcement
├── backend/                  # Server-side Python helpers and domain services
├── data/                     # Controlled datasets, registries, schemas, provenance
├── db/                       # Database migrations and persistence definitions
├── docs/                     # ADRs, procedures, evidence guidance, engineering records
├── packages/                 # Shared schemas and contracts
├── scripts/                  # Validation, CI, ingestion, GIS, operational tooling
├── tools/                    # Specialized engineering/data tools
├── tsm-console/              # React/TypeScript console, Node services, ingestion, tests
├── GOVERNMENT_QUICKSTART.md  # Government operator/developer quick start
├── SECURITY.md               # Security reporting and policy
└── README.md                 # Government engineering entry point
```

### Key contracts

| Path | Responsibility |
|---|---|
| `tsm-console/src/lib/gage-datums.ts` | Datum-aware gage conversions and published station references |
| `tsm-console/src/lib/firm-panel-ssot.ts` | FEMA FIRM panel single-source-of-truth record |
| `tsm-console/src/lib/jurisdiction-rules.ts` | Jurisdictional thresholds and governance rules |
| `tsm-console/server/ingestion/workers.mjs` | Observation ingestion and validation boundary |
| `data/schemas/tsm-site-constants-13101-bonebank.json` | Site engineering constants and metadata |
| `tsm-data-contract-schema-v1.0.0.json` | Data contract |
| `tsm-evidence-artifact-schema-v1.0.0.json` | Evidence artifact contract |
| `tsm-authority-registry-v35.json` | Authority/source registry |
| `docs/ADR-006-Agentic-Autonomy-Ladder-and-Tool-Scope-Policy.md` | Agentic autonomy policy |

---

## 7. Local engineering setup

### Prerequisites

- Node.js **22 or later**
- npm compatible with the repository's `packageManager` declaration
- Git
- Optional: local Keycloak for authenticated development
- Optional: local Ollama/llama.cpp for governed offline AI experimentation

### Reproducible install

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager/tsm-console
npm ci --no-audit --no-fund
```

### Development

```bash
npm run dev
```

Optional Node token proxy:

```bash
npm run proxy
```

### Production-equivalent preview

```bash
npm run build
npm run preview
```

### Full validation

```bash
npm run ci:full
```

The full command includes repository integrity, capability, workflow-boundary, artifact, quantum-isolation, shell-safety, site-consistency, parse, TypeScript, geospatial, build, and test gates.

---

## 8. Authentication and secret handling

The supported government-friendly identity pattern is a self-hosted OIDC provider such as Keycloak using **Authorization Code + PKCE** with a public browser client.

Rules:

- Never commit `.env` files containing secrets.
- Never put provider client secrets, API keys, bearer tokens, private keys, or passwords in browser bundles.
- Core build/test paths must remain usable without a paid AI provider.
- If a credential is ever committed, treat it as compromised: revoke/rotate it at the issuer and remove the secret from repository history using the organization's approved procedure.

Production identity deployments must use TLS, dedicated realms/tenants as appropriate, least-privilege roles, and organization-approved session/access policies.

---

## 9. CI/CD controls

The primary workflow is `.github/workflows/ci.yml`.

Required controls include:

- Node 22 and `npm ci`;
- exact commit binding for pushes to `main`;
- capability registry validation;
- workflow security-boundary validation;
- shell-safety validation;
- artifact contract validation;
- quantum isolation validation;
- repository integrity validation;
- site-consistency validation;
- geospatial contract validation;
- parse and TypeScript checks;
- production build;
- complete test suites.

Workflow jobs use least-privilege permissions. A failing gate must be diagnosed, not disabled to obtain a green build.

Production deployment must consume a verified build artifact or a commit that passed the required production validation gates.

---

## 10. Government engineering workflow

For a new engineering question:

1. **Identify authority** — determine which agency, ordinance, standard, or professional authority controls the decision.
2. **Identify evidence** — record source, version/date, station/product ID, units, CRS, vertical datum, and provenance.
3. **Validate inputs** — run applicable repository and domain gates.
4. **Perform calculation/simulation** — preserve assumptions, software version, parameters, and uncertainty.
5. **Separate result from determination** — label outputs as observation, calculation, simulation, or evidence artifact.
6. **Human review** — the responsible engineer/official determines whether the evidence supports an action.
7. **Archive evidence** — preserve hashes, source identifiers, timestamps, and review status.

Formal sealed engineering products and agency submissions remain outside automated TSM authority.

---

## 11. Security, safety, and reliability

TSM treats the following as high-risk classes:

- identity and authorization;
- geospatial datum/CRS transformations;
- floodplain and floodway interpretation;
- external telemetry ingestion;
- AI-generated recommendations;
- evidence integrity;
- automated deployment.

Changes affecting these classes require explicit validation and should be classified under the repository's change-control procedure in `docs/CHANGE-CONTROL.md`.

Security reporting procedures are in `SECURITY.md`.

---

## 12. Performance engineering

The current console uses explicit vendor chunking for large mapping and 3D dependencies. MapLibre and Three.js are intentionally substantial client-side dependencies. Bundle-size warnings are performance work items, not permission to remove engineering functionality without profiling.

Future performance work should use measured bundle analysis, route-level loading, cache policy, asset compression, and WebGL/WebGPU profiling rather than speculative dependency removal.

---

## 13. Troubleshooting

### CI is red

1. Open the failed job and identify the first failing gate.
2. Reproduce the corresponding npm script locally.
3. Determine whether the failure is code, dependency, repository state, data contract, or GitHub platform configuration.
4. Do not weaken a fail-closed gate to force green.

### Gage/WSE values disagree

Check, in order:

1. station/product identity;
2. observation timestamp;
3. source gage datum;
4. target vertical datum;
5. published datum conversion;
6. units;
7. whether the value is an observation or a derived WSE.

Never fix a datum discrepancy by changing a label.

### FEMA products disagree

Preserve both source records, record effective dates/product identifiers, and escalate to the responsible floodplain professional/authority. NFHL identify results do not by themselves create a regulatory determination.

### Build works locally but CI fails

Compare Node version, npm version, lockfile, working directory, environment variables, and the exact commit SHA. The repository is designed so `npm ci` and the CI validation sequence expose drift rather than silently correcting it.

---

## 14. Change management and cleanup

`main` is the long-lived source of truth. See:

- `docs/REPOSITORY-STRUCTURE.md` — directory ownership and cleanup rules
- `docs/CHANGE-CONTROL.md` — engineering change classes and evidence requirements
- `docs/REPOSITORY-CLEANUP-LEDGER.md` — recorded structural cleanup decisions
- `docs/superpowers/specs/` — approved architecture/design records
- `docs/superpowers/plans/` — implementation plans

Files are not deleted merely because they appear unused. Imports, scripts, workflows, documentation links, schemas, migrations, deployment manifests, and runtime loaders must be checked first.

---

## 15. Professional and regulatory limitations

TSM is decision-support software. It is not a substitute for:

- a licensed professional engineer where professional engineering judgment is required;
- a land surveyor where a boundary/elevation survey is required;
- the responsible local floodplain administrator;
- Indiana DNR Division of Water;
- FEMA or another controlling agency;
- the controlling FIRM/FIS, permit, order, or legally adopted ordinance.

When an output will be used for a regulatory filing, permit, design certification, or public-safety decision, the responsible professional must verify the source products, datum, assumptions, calculations, and applicable law independently.

---

## 16. License and stewardship

TSM is released under the Apache License 2.0. See `LICENSE` for the complete license text.

The project is maintained as a public-interest engineering system. Its design objective is to make evidence, assumptions, uncertainty, and authority visible rather than hiding them behind automation.

**Technology informs people. It does not silently govern people.**
