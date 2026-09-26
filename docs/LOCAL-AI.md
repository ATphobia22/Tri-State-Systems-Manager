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
  scenarioName: string;        // e.g. "100-year overbank, Bonebank Rd reach"
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
npx vitest run tests/local-ai-availability.test.ts tests/local-ai-assistant.test.ts
npx tsc --noEmit
npm run build
```
