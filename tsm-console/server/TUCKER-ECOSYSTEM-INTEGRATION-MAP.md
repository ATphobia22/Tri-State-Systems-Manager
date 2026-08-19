# Tucker Ecosystem → TSM Integration Map

Scope control: TSM remains the **public-interest Tri-State** platform (Evidence, Simulation, Governance, Public UI).  
“Tucker AI databases” and product lines (power, PCM batteries, grant stacking, photoreal 3D) are **adjacent product planes**. Integrate only through explicit contracts; never collapse commercial product claims into regulatory evidence.

## Repo scan (ATphobia22) — useful research forks only

| Repo | Domain | Possible future use (dependency, not vendored) |
|------|--------|--------------------------------------------------|
| **PyPSA** / **pypsa-usa** | Power system optimization | Tucker Power planning scenarios (Scientific/Benefit plane adapters) |
| **green-energy-hub** | Energy transmission data patterns | Grid/context data contracts |
| **OpenModelica** | Multi-physics Modelica | Coupled simulation research (with OpenMI notes) |
| **openml-python** | OpenML datasets/API | Governed ML experiment tracking (not silent regulatory AI) |
| **langfuse** (prior) | LLM observability | If assistants are added: model cards + audit |
| **creact** | Durable JSX workflows | Optional workflow UI patterns |
| **paperbanana** | Research figures | Documentation generation only |
| **ort** | OSS dependency review | Supply-chain hygiene for open-source governance |
| **OpenWorldLib** | World models | Research only — high risk if confused with digital twin truth |
| **generative-recommenders** | Recommenders | Grant/program discovery ranking (human gate) |
| **dseco** | DNS ontology | Out of scope for flood/community twin |
| **whistle** | HTTP debug proxy | Dev tooling only |

All listed items are **forks**. Prefer upstream packages; do not copy large trees into TSM.

## Ecosystem elements → plane mapping

| Element | TSM plane | Notes |
|---------|-----------|-------|
| Grant stacking + form assist | Governance / Benefit | Templates + citations; **human signs**; no auto-submit as determination |
| Power company / PyPSA plans | Scientific / Benefit | Scenario outputs = MODEL_OUTPUT + assumptions |
| PCM battery product ideas | Product (external) | Keep separate product DB; link by ID only |
| Maps, tiles, satellite | Public Visualization | MapLibre + IGIO/FEMA layers already |
| 3D footprints / materials | Visualization | R3F/MapLibre; tag DERIVED/VISUALIZATION |
| Forestry / agriculture | Context | NASS, ISDA, IGWS already cataloged |
| Health care | Human Needs | Aggregate indicators only — **no PHI** |
| Oil wells | Context | IGWS GDMS / state sources if added later |
| Streets/roads | Context | IGIO Current centerlines |

## Recommended next build slices (ordered)

1. **Grant intelligence schema** — program registry (IFA Flood Control, LARE, EPA, USDA RD) + state machine already sketched; document autofill = field mapping to *draft* PDFs only.  
2. **Energy scenario adapter stub** — optional PyPSA-USA import path as offline job → EvidenceArtifact.  
3. **Layer pack** — enable FEMA NFHL + BAFM toggles when CORS/proxy ready.  
4. **Separate product monorepo** (if desired) for PCM/power commercial UI — must not share authoritative floodway/FARA write paths with TSM public plane.

## Non-goals for this pass

- Building a full “Tucker AI database” platform in this commit  
- Auto-filing grants or permits  
- Photoreal city-scale 3D as regulatory evidence  
- Merging commercial battery SKUs into the Evidence Ledger

