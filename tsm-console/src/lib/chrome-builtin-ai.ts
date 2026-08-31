/**
 * Chrome Built-in AI — progressive enhancement for TSM presentation plane.
 *
 * APIs (Chrome): LanguageModel (Prompt), Summarizer, Writer, Rewriter,
 * Translator, LanguageDetector, Proofreader (availability varies).
 *
 * Rules:
 * - Optional UX only (summarize ledger notes, plain-language help).
 * - NEVER authority_class OBSERVATION / never mutate Evidence Ledger.
 * - Output is AI_ASSIST / DERIVATION at best; human gate required.
 * - Feature-detect; degrade silently when unavailable.
 *
 * Entry points (post April 2025 PSA): self.LanguageModel / Summarizer etc.
 * with static availability() and create() — not self.ai.*.
 */

export type BuiltinAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

export type ChromeAiCapability =
  | 'languageModel'
  | 'summarizer'
  | 'writer'
  | 'rewriter'
  | 'translator'
  | 'languageDetector'
  | 'proofreader';

declare global {
  interface Window {
    LanguageModel?: {
      availability: (opts?: unknown) => Promise<BuiltinAvailability>;
      create: (opts?: unknown) => Promise<{
        prompt: (input: string, opts?: unknown) => Promise<string>;
        promptStreaming?: (input: string, opts?: unknown) => AsyncIterable<string>;
        destroy?: () => void;
      }>;
    };
    Summarizer?: {
      availability: (opts?: unknown) => Promise<BuiltinAvailability>;
      create: (opts?: unknown) => Promise<{
        summarize: (input: string, opts?: unknown) => Promise<string>;
        destroy?: () => void;
      }>;
    };
    Writer?: {
      availability: (opts?: unknown) => Promise<BuiltinAvailability>;
      create: (opts?: unknown) => Promise<{
        write: (input: string, opts?: unknown) => Promise<string>;
        destroy?: () => void;
      }>;
    };
    Rewriter?: {
      availability: (opts?: unknown) => Promise<BuiltinAvailability>;
      create: (opts?: unknown) => Promise<{
        rewrite: (input: string, opts?: unknown) => Promise<string>;
        destroy?: () => void;
      }>;
    };
    Translator?: {
      availability: (opts?: unknown) => Promise<BuiltinAvailability>;
      create: (opts?: unknown) => Promise<{
        translate: (input: string) => Promise<string>;
        destroy?: () => void;
      }>;
    };
    LanguageDetector?: {
      availability: (opts?: unknown) => Promise<BuiltinAvailability>;
      create: (opts?: unknown) => Promise<{
        detect: (input: string) => Promise<unknown>;
        destroy?: () => void;
      }>;
    };
    Proofreader?: {
      availability: (opts?: unknown) => Promise<BuiltinAvailability>;
      create: (opts?: unknown) => Promise<{
        proofread: (input: string) => Promise<unknown>;
        destroy?: () => void;
      }>;
    };
  }
}

const API_MAP: Record<ChromeAiCapability, keyof Window> = {
  languageModel: 'LanguageModel',
  summarizer: 'Summarizer',
  writer: 'Writer',
  rewriter: 'Rewriter',
  translator: 'Translator',
  languageDetector: 'LanguageDetector',
  proofreader: 'Proofreader',
};

export async function checkCapability(
  name: ChromeAiCapability,
  options?: unknown
): Promise<BuiltinAvailability> {
  if (typeof window === 'undefined') return 'unavailable';
  const key = API_MAP[name];
  const api = window[key] as
    | { availability?: (o?: unknown) => Promise<BuiltinAvailability> }
    | undefined;
  if (!api?.availability) return 'unavailable';
  try {
    return await api.availability(options);
  } catch {
    return 'unavailable';
  }
}

export async function probeBuiltinAi(): Promise<Record<ChromeAiCapability, BuiltinAvailability>> {
  const keys = Object.keys(API_MAP) as ChromeAiCapability[];
  const out = {} as Record<ChromeAiCapability, BuiltinAvailability>;
  await Promise.all(
    keys.map(async (k) => {
      out[k] = await checkCapability(k);
    })
  );
  return out;
}

/**
 * Summarize text for accessibility / operator assist.
 * Returns null if Summarizer or Prompt API unavailable.
 */
export async function summarizeForOperator(
  text: string,
  opts?: { maxChars?: number }
): Promise<{ summary: string; engine: 'summarizer' | 'languageModel'; isAiAssist: true } | null> {
  const clipped = text.slice(0, opts?.maxChars ?? 12_000);
  if (!clipped.trim()) return null;

  const sumAvail = await checkCapability('summarizer');
  if (sumAvail === 'available' || sumAvail === 'downloadable' || sumAvail === 'downloading') {
    try {
      const summarizer = await window.Summarizer!.create({
        sharedContext: 'Public-interest flood and geospatial operations console. Be factual and concise.',
        type: 'tldr',
        format: 'plain-text',
        length: 'short',
      });
      const summary = await summarizer.summarize(clipped);
      summarizer.destroy?.();
      return { summary, engine: 'summarizer', isAiAssist: true };
    } catch {
      /* fall through */
    }
  }

  const lmAvail = await checkCapability('languageModel', {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  });
  if (lmAvail === 'unavailable') return null;
  try {
    const session = await window.LanguageModel!.create({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    const summary = await session.prompt(
      `Summarize the following operations log for a floodplain engineer in 3 short bullets. Do not invent facts.\n\n${clipped}`
    );
    session.destroy?.();
    return { summary, engine: 'languageModel', isAiAssist: true };
  } catch {
    return null;
  }
}

/** Plain-language rewrite of a compliance finding — still AI_ASSIST only */
export async function plainLanguageFinding(
  finding: string,
  context: string
): Promise<{ text: string; isAiAssist: true } | null> {
  const avail = await checkCapability('languageModel');
  if (avail === 'unavailable') return null;
  try {
    const session = await window.LanguageModel!.create();
    const text = await session.prompt(
      `Explain this flood-stage finding in plain language for a resident. ` +
        `Do not give legal advice. Finding: ${finding}. Context: ${context}`
    );
    session.destroy?.();
    return { text, isAiAssist: true };
  } catch {
    return null;
  }
}

export const CHROME_AI_POLICY = {
  plane: 'Public Visualization / operator assist',
  authorityClass: 'AI_ASSIST',
  mayMutateEvidence: false,
  requiresHumanGate: true,
  docs: [
    'https://developer.chrome.com/docs/ai/prompt-api',
    'https://developer.chrome.com/docs/ai/summarizer-api',
  ],
} as const;
