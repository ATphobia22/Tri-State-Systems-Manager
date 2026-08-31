# Chrome Built-in AI — TSM integration

Index source: Built-in AI Early Preview Program context (goo.gle/chrome-ai-dev-preview-index), Aug 2026.

## Useful APIs

| API | TSM use |
|-----|---------|
| **Summarizer** | Operator TL;DR of ledger / terminal logs |
| **LanguageModel** (Prompt) | Plain-language finding explanations |
| **Writer / Rewriter** | Optional draft assist for public notices (human edit required) |
| **Translator / LanguageDetector** | Accessibility for multi-lingual residents (desktop Chrome) |
| **Proofreader** | Draft hygiene only |
| **Embedding** (preview) | Future local semantic search over docs — not wired yet |
| **WebMCP** | Future agent tooling — not required for Phase 1 |

## API shape (post 2025 PSA)

```js
await LanguageModel.availability({ ... });
const session = await LanguageModel.create({ ... });
await session.prompt('...');
```

Not `self.ai.*`.

## Hard rules

1. **Progressive enhancement** — core flood evidence works with zero built-in AI.
2. AI output authority = **AI_ASSIST** only; never silent OBSERVATION.
3. No auto-LOMA, no auto-FARA, no evidence mutation from model text.
4. Prefer on-device models for privacy of parcel/family context when available.
5. Secure context (HTTPS / localhost) required.

## Code

- `src/lib/chrome-builtin-ai.ts` — detection + summarize helpers  
- `src/components/BuiltinAiAssistPanel.tsx` — optional UI  

Wire panel into Ledger or Sandbox only behind a feature flag if desired.

