# Local AI — On-Device Built-in AI Module

## What the PDF program is

`~/workspace/user/files/Built-in_AI_Early_Preview_Program_-_The_Context_Index.pdf`
is an **index of Chrome's Built-in AI Early Preview Program**, not a model
distribution. It catalogs the on-device Gemma APIs exposed to web pages:

- **Prompt API** — `LanguageModel.create()` / `LanguageModel.availability()` on
  the `self` scope (post-April-2025 naming; replaces `self.ai.*`).
- **Task APIs** — Summarizer, Proofreader, Writer/Rewriter, Translator, Language
  Detector, Embedding API.
- Latest index entries: Gemma 4, Embedding API, Sampling Parameters origin trial.

**Honesty note:** the PDF contains **no model weights and no code to scrape**.
Nothing was trained, embedded, or shipped from it. This module calls the
*device's own* on-device model through the browser's Prompt API. On a device
without Chrome's built-in AI, every function in this module reports
`unavailable` and does nothing else.

## What was integrated

New standalone module `tsm-console/src/lib/local-ai/` + mountable component
`tsm-console/src/components/LocalAiPanel.tsx`:

| File | Purpose |
|---|---|
| `src/lib/local-ai/availability.ts` | Feature detection: `LanguageModel.availability()` + Summarizer/Proofreader/Writer. Never throws (guards `typeof self`, iOS WKWebView safe). Returns per-API `'available' \| 'downloading' \| 'unavailable'` + human-readable `reason`. |
| `src/lib/local-ai/assistant.ts` | Typed wrappers: `explainFloodResult`, `askFloodplainQuestion`, `summarizeEvidencePacket` (Summarizer API), `proofreadFiling` (Proofreader API). |
| `src/lib/local-ai/index.ts` | Public API surface (types + functions). |
| `src/components/LocalAiPanel.tsx` | Panel: capability list, textarea/prompt input, result display with provisional label, clear DISABLED state. |
| `tests/local-ai-availability.test.ts` | Vitest: token mapping, never-throw paths, zero-fetch. |
| `tests/local-ai-assistant.test.ts` | Vitest: axiom-in-prompt assertion, fail-closed paths, provenance, zero-fetch. |

Prior art: `src/lib/chrome-builtin-ai.ts` + `src/components/BuiltinAiAssistPanel.tsx`
(generic progressive enhancement). The new `local-ai/` module is intentionally
**standalone** and scoped to the flood-simulator integration contract below.

## Availability requirements

- Chrome (desktop or Android) with built-in AI enabled and the on-device Gemma
  model present/downloaded. The model downloads through Chrome itself — this
  module never fetches it.
- **iOS WKWebView is currently unsupported**: Apple does not expose
  `LanguageModel`/Summarizer/Proofreader on iOS. The panel explains this in its
  disabled state.
- When the model is `downloading`/`downloadable`, the module reports
  `downloading` and **does not attempt session creation** (fail-closed,
  deterministic behavior rather than hanging on a multi-minute download).

## Non-negotiable properties

1. **Fail-closed.** If the needed API is unavailable, functions return
   `{ status: 'unavailable', reason }`. No fake results, no server fallback.
2. **Zero network.** This path never calls the Node/FastAPI backends. Enforced
   by tests that spy on global `fetch` and assert 0 calls across all paths.
3. **No websockets.** `WebSocket`/`socket.io`/`ws` appear nowhere in this module.
4. **Governing axiom in every system prompt:**
   > "Technology informs people; it does not silently govern people. Human authority remains final."
5. **Provenance on every AI output:** `{ model: 'on-device built-in AI (Gemma)', provenance: 'model-generated', status: 'provisional', humanReviewRequired: true }` plus the visible label **"AI-generated — provisional, human review required"**. UI consumers must render the label adjacent to the text.
6. **Decision-support only.** Never presented as FEMA submission/approval/certification. AI summaries are AI_ASSIST/DERIVATION at best and never enter the Evidence Ledger.

## Privacy property

Everything runs on the device. Scenario summaries, packet text, and filing text
are passed to the browser's on-device model only; no request leaves the module.
This is deliberate — sensitive floodplain/filing content stays local — and it is
enforced by the zero-fetch tests, not just by convention.

## Integration contract — flood simulator team ("AI engineer copilot")

The simulator team (`tsm-console/src/lib/flood-sim/`, built in parallel) is the
intended producer of `FloodScenarioSummary`. Contract:

**Option A — mount the panel:**
```tsx
import { LocalAiPanel } from '../components/LocalAiPanel';

<LocalAiPanel
  scenarioSummary={floodSim.toLocalAiSummary()}  // FloodScenarioSummary
  packet={evidenceStore.toLocalAiPacket()}       // EvidencePacketSummary (optional)
/>
```
The "Explain flood result" button activates when `scenarioSummary` is provided
and the Prompt API is ready; "Summarize evidence packet" likewise for `packet`.

**Option B — call the assistant directly:**
```ts
import { explainFloodResult, askFloodplainQuestion } from '../lib/local-ai';

const result = await explainFloodResult(floodSim.toLocalAiSummary());
if (result.ok) {
  // result.text, result.model, result.provenance, result.status === 'provisional'
  // MUST display result.label next to result.text
  renderExplanation(result.text, result.label);
} else {
  // result.status === 'unavailable', result.reason — show disabled state, no fallback
}
```

**`FloodScenarioSummary` fields** (all optional except `scenarioName` and
`keyFindings`):
```ts
{
  scenarioName: string;        // e.g. "100-year overbank, restricted site reach"
  peakDepthFt?: number;
  areaInundatedAcres?: number;
  structuresAffected?: number;
  returnPeriodYears?: number;
  keyFindings: string[];       // plain-text findings the simulator computed
}
```

**Rules for the simulator team:**
- The simulator owns all numbers. `local-ai` only narrates; it must never be
  asked to compute depths, extents, or damages.
- `keyFindings` must contain only values the simulator actually computed — the
  system prompt instructs the model not to invent numbers, but the input is the
  real guard.
- Render `AiTextResult.label` adjacent to `result.text` in every UI.
- On `unavailable`, show the reason and stop. Do not retry against a server model.

## Verification

```bash
npx vitest run tests/local-ai-availability.test.ts tests/local-ai-assistant.test.ts tests/local-ai-skills.test.ts
npx tsc --noEmit
npm run build
```

## Expert skill packs (`src/lib/local-ai/skills/`)

Thirteen static domain packs give the on-device model expert context for the
"AI engineer copilot". Each pack is a versioned JSON file with:

- **preamble** — expert role + the governing axiom verbatim + "AI-generated
  output is provisional, human review required". This text is **model-general**
  (guidance, not verified facts).
- **repo_grounded_facts** — reference knowledge verified **against the TSM
  repository only**; every statement names its source file and carries a
  provenance label. The copilot must cite numbers only from these.
- **hard_rules** — domain prohibitions (never invent data/constants; legal
  pack = legal information only, etc.).
- **disclaimers**, **keywords** (deterministic router), **not_built**
  (capabilities explicitly not grounded — never faked).

`skills/index.ts` exports `listSkillPacks()`, `getSkillPack(id)`, and
`routeQuery(query)` — a deterministic keyword scorer (fixed registration-order
tie-break, no randomness; falls back to the science pack when no keyword
matches). `assistant.ts` wires routing into `askFloodplainQuestion` and the
new `askCopilot(question, context?)` entry point: the selected packs'
preambles + repo-grounded facts are prepended to the system prompt. When the
legal pack routes, the model is instructed to close with the disclaimer line
"This is legal information only, not legal advice — consult licensed counsel."
Packs are bundled static data, so the zero-fetch property holds (covered by
the fetch-spy tests in `tests/local-ai-skills.test.ts`).

### Skill-pack catalog

| Domain (pack id) | Grounding source repo file(s) | Capabilities | repo-grounded vs model-general |
|---|---|---|---|
| Engineering (`engineering`) | `tsm-console/src/lib/hydraulics-diffusion2d.ts`, `hydrology-runoff.ts`, `hazus-depth-damage.ts`, `hec-ras-contracts.ts`, `scientific-analytics.ts`, `data/schemas/engineering-evidence-pipeline-v1.schema.json` | SCS runoff equation, Manning flux + stability, Hazus depth-damage, evidence-pipeline stages, site elevations | repo-grounded: equations, stability criterion, stage order, site constants; model-general: role/guidance prose |
| Hydrology (`hydrology`) | `tsm-console/src/lib/hydrology-runoff.ts`, `gage-datums.ts`, `river-gauges.ts`, `scenario-runner.ts`, `hydraulics-diffusion2d.ts` | Runoff, gage-datum rule, 12 gauge stations, no-interpolation rule | repo-grounded: SCS equation, WSE_NAVD88 rule, station IDs/variables; model-general: role/guidance prose |
| Coding (`coding`) | `docs/LOCAL-AI.md`, `docs/BUILD-IOS.md`, `tsm-console/src/lib/local-ai/assistant.ts`, `availability.ts`, `docs/DRIVE-MANIFEST.md` | Stack, test/build commands, zero-network rules, secrets policy | repo-grounded: commands, constants, policy notes; model-general: role/guidance prose |
| Design (`design`) | `docs/LOCAL-AI.md`, `tsm-console/src/components/LocalAiPanel.tsx`, `docs/CINEMATIC-REFERENCE-COVERAGE.md`, `tsm-console/src/lib/twin-map-style.ts`, `docs/APPLE-MAPS-CONTEXT-FABRIC.md`, `assistant.ts` | Panel UI, cinematic coverage, map styles, plain-language rule | repo-grounded: component behavior, doc existence; model-general: role/guidance prose |
| Mapping (`mapping`) | `data/registries/tri-state-rest-endpoints-v1.json`, `data/registries/fema-firm-panel-registry-v1.json`, `data/schemas/tri-state-rest-endpoint.schema.json`, `tsm-console/src/lib/firm-panel-ssot.ts`, `scientific-analytics.ts`, `h3-spatial-fabric.ts`, `hec-ras-contracts.ts`, `siteConstants.ts` | State CRS codes, 16 REST endpoint IDs, FIRM panel SSOT, H3 fabric, site coordinates | repo-grounded: EPSG codes, endpoint IDs, panel 18129C0265C, coordinates; model-general: role/guidance prose |
| Geology (`geology`) | `data/registries/tri-state-rest-endpoints-v1.json`, `db/migrations/V35__subsurface_layers.sql`, `tsm-console/src/lib/hec-ras-contracts.ts`, `scientific-analytics.ts` | ISGS bedrock/drift/SSURGO layers, subsurface schema, 3DEP terrain | repo-grounded: layer names, table names; model-general: role/guidance prose |
| Meteorology (`meteorology`) | `tsm-console/src/lib/river-gauges.ts`, `hydrology-runoff.ts`, `provenance-labels.ts` | NWS stage-observation IDs, SCS limits, FORECAST label | repo-grounded: NWS IDs as observations, no-snowmelt limit; model-general: role/guidance prose |
| Legal (`legal`) | `tsm-console/src/lib/fema-loma-evidence.ts`, `docs/FAST-LANE-LOMA.md`, `docs/FEMA-LOMA-LAYER2-CASE-PLAN.md`, `docs/regulatory/loma/loma-package-checklist.md`, `no-rise-certification-DRAFT.md`, `scientific-analytics.ts` | LOMA/MT-1 procedure, 90-day track, deed/plat, Part B, Daubert note | repo-grounded: case 26-05-2022A, 2026-12-21 date, procedural checklist items; model-general: role/guidance prose |
| Science (`science`) | `tsm-console/src/lib/provenance-labels.ts`, `scientific-analytics.ts`, `docs/ENGINEERING-GATE.md` | Provenance taxonomy, evidence quality, uncertainty, coordinate discrepancy | repo-grounded: 8 labels, freeboard margins, RMSE note, Daubert note; model-general: role/guidance prose |
| Mathematics (`mathematics`) | `tsm-console/src/lib/hydrology-runoff.ts`, `hydraulics-diffusion2d.ts`, `scientific-analytics.ts`, `h3-spatial-fabric.ts` | SCS/Manning math, 645.33 derivation, freeboard arithmetic, H3 chain | repo-grounded: equations and derivations; model-general: role/guidance prose |
| Geotechnical (`geotechnical`) | `db/migrations/V35__subsurface_layers.sql`, `data/registries/tri-state-rest-endpoints-v1.json`, `data/schemas/engineering-evidence-pipeline-v1.schema.json`, `tsm-console/src/lib/scientific-analytics.ts` | Subsurface schema, SSURGO soils, earthwork stages, berm crest | repo-grounded: table names, stage names, berm elevation; model-general: role/guidance prose |
| Regulatory (`regulatory`) | `data/schemas/engineering-evidence-pipeline-v1.schema.json`, `data/schemas/tsm-authority-registry-v35.json`, `tsm-console/src/lib/siteConstants.ts`, `firm-panel-ssot.ts`, `docs/FAST-LANE-LOMA.md`, `FEMA-LOMA-LAYER2-CASE-PLAN.md`, `fema-loma-evidence.ts`, `docs/ADR-006-*.md` | Pipeline stages, authority registry, NFIP community IDs, 90-day track | repo-grounded: 13 stages, CIDs 180209/180389/180210, governance axiom; model-general: role/guidance prose |
| Grants (`grants`) | `artifacts/grants/tri-state-flood-resilience-program-registry-v1.json` | Funding program IDs/statuses, verification policy | repo-grounded: 5 program IDs + statuses, registry policy; model-general: role/guidance prose |

### Not built (explicitly not grounded — the copilot must not fake these)

- Legal: attorney review, case-law research.
- Geology/geotechnical: site borehole logs, laboratory test data; slope-stability and bearing-capacity models do not exist in the repo.
- Meteorology: NWS forecast API integration, radar precipitation feeds, snowmelt modeling.
- Grants: live NOFO status checks, award guarantees or eligibility determinations.
- Regulatory: agency submission/filing, regulatory determinations.
- Science: peer-reviewed publication of site findings, an independently verified site survey.
- Mathematics: a symbolic equation solver.
- Engineering: PE-stamped designs or certifications, real-time structural health monitoring.
- Mapping: a certified parcel boundary survey (owner coordinates carry an unresolved ~6.4 km discrepancy).
- Coding: publishing releases (no GitHub authentication in this environment).
- Design: user-testing results, a certified accessible-design audit.

### Router examples

- "is this crest plausible?" → hydrology + mathematics
- "help me draft the LOMA response" → legal + engineering (legal disclaimer forced into output)
- "Which EPSG code should I use for Illinois data?" → mapping
- "List the evidence pipeline stages in order" → regulatory
