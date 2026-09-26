/**
 * local-ai/assistant — typed wrapper over Chrome's built-in on-device AI.
 *
 * Wrapped APIs:
 * - Prompt API (`LanguageModel.create()`): explainFloodResult, askFloodplainQuestion
 * - Summarizer API: summarizeEvidencePacket
 * - Proofreader API: proofreadFiling
 *
 * Non-negotiable properties:
 * - Fail-closed: when the needed API is not 'available', every function returns
 *   `{ status: 'unavailable', reason }`. No fake results, no server fallback.
 * - Governing axiom is embedded in every system prompt:
 *   "Technology informs people; it does not silently govern people. Human authority remains final."
 * - Every successful result carries provenance + provisional status, and UI
 *   consumers MUST show the PROVISIONAL_LABEL next to the text.
 * - No network calls, no websockets. 100% local. Enforced by zero-fetch tests.
 * - Decision-support only. Never claim FEMA submission/approval.
 */

import {
  getLocalAiCapabilities,
  type LocalAiCapabilityId,
} from './availability';

export const GOVERNING_AXIOM =
  'Technology informs people; it does not silently govern people. Human authority remains final.';

export const PROVISIONAL_LABEL = 'AI-generated — provisional, human review required';

/** Honest model attribution: the device's on-device model, not a shipped weight file. */
export const AI_MODEL_NAME = 'on-device built-in AI (Gemma)' as const;

export const MAX_INPUT_CHARS = 8000;
const CALL_TIMEOUT_MS = 60_000;

/**
 * Summary contract consumed from the flood simulator team
 * (`tsm-console/src/lib/flood-sim/`). The simulator owns the numbers; this
 * module only explains them in plain language.
 */
export interface FloodScenarioSummary {
  scenarioName: string;
  peakDepthFt?: number;
  areaInundatedAcres?: number;
  structuresAffected?: number;
  returnPeriodYears?: number;
  /** Plain-text findings from the simulator (numbers it computed). */
  keyFindings: string[];
}

/** Summary of an evidence packet to be condensed for operator review. */
export interface EvidencePacketSummary {
  packetId: string;
  title: string;
  /** Short descriptions of packet items (never full document text). */
  items: string[];
  authorityClass?: string;
}

export type AiTextResult =
  | {
      ok: true;
      text: string;
      model: typeof AI_MODEL_NAME;
      provenance: 'model-generated';
      status: 'provisional';
      humanReviewRequired: true;
      /** Must be shown adjacent to `text` in any UI. */
      label: typeof PROVISIONAL_LABEL;
    }
  | {
      ok: false;
      status: 'unavailable';
      reason: string;
      humanReviewRequired: true;
    };

function unavailable(reason: string): AiTextResult {
  return { ok: false, status: 'unavailable', reason, humanReviewRequired: true };
}

function provisional(text: string): AiTextResult {
  return {
    ok: true,
    text,
    model: AI_MODEL_NAME,
    provenance: 'model-generated',
    status: 'provisional',
    humanReviewRequired: true,
    label: PROVISIONAL_LABEL,
  };
}

function truncate(input: string): string {
  if (input.length <= MAX_INPUT_CHARS) return input;
  return `${input.slice(0, MAX_INPUT_CHARS)}… [truncated for on-device context]`;
}

function getBuiltinGlobal<T>(globalName: string): T | undefined {
  const scope: unknown =
    typeof self !== 'undefined' ? (self as unknown) : undefined;
  if (!scope || typeof scope !== 'object' || scope === null) return undefined;
  const candidate = (scope as Record<string, unknown>)[globalName];
  return (candidate ?? undefined) as T | undefined;
}

async function requireCapability(
  id: LocalAiCapabilityId,
  globalName: string,
): Promise<AvailabilityLike | AiTextResult> {
  const report = await getLocalAiCapabilities();
  const cap = report.capabilities[id];
  if (cap.status !== 'available') {
    return unavailable(
      `${cap.displayName} is not ready (${cap.status}). ${cap.reason}`,
    );
  }
  const factory = getBuiltinGlobal<AvailabilityLike>(globalName);
  if (!factory || typeof factory.create !== 'function') {
    return unavailable(`${globalName} is not constructible in this browser.`);
  }
  return factory;
}

function isUnavailable<T>(v: T | AiTextResult): v is AiTextResult {
  return typeof v === 'object' && v !== null && 'ok' in v && v.ok === false;
}

interface AvailabilityLike {
  create: (options?: unknown) => Promise<unknown>;
}

interface PromptSessionLike {
  prompt: (input: string, options?: unknown) => Promise<string>;
  destroy?: () => void;
}

interface SummarizerSessionLike {
  summarize: (input: string, options?: unknown) => Promise<string>;
  destroy?: () => void;
}

interface ProofreaderSessionLike {
  proofread: (input: string) => Promise<{ correctedInput: string } | string>;
  destroy?: () => void;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${CALL_TIMEOUT_MS}ms`)),
      CALL_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function buildSystemPrompt(role: string): string {
  return [
    `You are ${role} inside the Tri-State Systems Manager (TSM) flood console, a government engineering decision-support tool.`,
    `Governing axiom: "${GOVERNING_AXIOM}"`,
    'Rules:',
    '- You provide decision-support explanations only. This is not an official determination.',
    '- Never present output as a FEMA submission, approval, or certification.',
    '- Use plain language suitable for a non-technical operator.',
    '- A qualified human must review any action taken from your output.',
  ].join('\n');
}

async function runPromptSession(
  systemPrompt: string,
  userPrompt: string,
): Promise<AiTextResult> {
  const factory = await requireCapability('prompt', 'LanguageModel');
  if (isUnavailable(factory)) return factory;
  let session: PromptSessionLike | undefined;
  try {
    const created = await withTimeout(
      factory.create({
        systemPrompt,
        temperature: 0.3,
        topK: 40,
      }) as Promise<PromptSessionLike>,
      'Prompt API create',
    );
    session = created;
    const text = await withTimeout(
      session.prompt(truncate(userPrompt)),
      'Prompt API prompt',
    );
    if (typeof text !== 'string' || text.trim().length === 0) {
      return unavailable('Prompt API returned an empty result.');
    }
    return provisional(text);
  } catch (err) {
    return unavailable(
      `Prompt API failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    try {
      session?.destroy?.();
    } catch {
      /* ignore cleanup errors */
    }
  }
}

function formatNumber(value: number | undefined, unit: string): string {
  return value === undefined ? 'not reported' : `${value} ${unit}`;
}

function formatScenario(s: FloodScenarioSummary): string {
  const lines = [
    `Scenario: ${s.scenarioName}`,
    `Peak flood depth: ${formatNumber(s.peakDepthFt, 'ft')}`,
    `Area inundated: ${formatNumber(s.areaInundatedAcres, 'acres')}`,
    `Structures affected: ${s.structuresAffected ?? 'not reported'}`,
    `Return period: ${formatNumber(s.returnPeriodYears, 'years')}`,
  ];
  if (s.keyFindings.length > 0) {
    lines.push('Simulator findings:');
    for (const f of s.keyFindings) lines.push(`- ${f}`);
  }
  return lines.join('\n');
}

/**
 * Explain a flood simulation result in plain language via the on-device
 * Prompt API. The simulator owns the numbers; this only narrates them.
 */
export async function explainFloodResult(
  scenarioSummary: FloodScenarioSummary,
): Promise<AiTextResult> {
  const systemPrompt = buildSystemPrompt(
    'a plain-language explainer for flood simulation results',
  );
  const userPrompt = [
    'Explain this flood simulation result in plain language for an operator.',
    'Do not invent numbers; only use the values given below.',
    formatScenario(scenarioSummary),
    'End with: "This explanation is decision-support only and must be reviewed by a qualified engineer before any action."',
  ].join('\n\n');
  return runPromptSession(systemPrompt, userPrompt);
}

/**
 * Free-form question answering over the on-device Prompt API.
 * Entry point for the "AI engineer copilot" in the simulator UI.
 */
export async function askFloodplainQuestion(question: string): Promise<AiTextResult> {
  if (question.trim().length === 0) {
    return unavailable('No question provided.');
  }
  const systemPrompt = buildSystemPrompt(
    'an AI engineer copilot answering floodplain questions',
  );
  return runPromptSession(systemPrompt, question);
}

/**
 * Summarize an evidence packet via the on-device Summarizer API.
 * Summaries are AI_ASSIST / DERIVATION at best — never evidence.
 */
export async function summarizeEvidencePacket(
  packet: EvidencePacketSummary,
): Promise<AiTextResult> {
  const factory = await requireCapability('summarizer', 'Summarizer');
  if (isUnavailable(factory)) return factory;
  let session: SummarizerSessionLike | undefined;
  try {
    session = await withTimeout(
      factory.create({
        type: 'key-points',
        format: 'markdown',
        length: 'medium',
      }) as Promise<SummarizerSessionLike>,
      'Summarizer create',
    );
    const input = truncate(
      [
        `Evidence packet: ${packet.title} (${packet.packetId})`,
        packet.authorityClass ? `Authority class: ${packet.authorityClass}` : '',
        'Items:',
        ...packet.items.map((item) => `- ${item}`),
      ]
        .filter((line) => line.length > 0)
        .join('\n'),
    );
    const text = await withTimeout(session.summarize(input), 'Summarizer summarize');
    if (typeof text !== 'string' || text.trim().length === 0) {
      return unavailable('Summarizer returned an empty result.');
    }
    return provisional(text);
  } catch (err) {
    return unavailable(
      `Summarizer failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    try {
      session?.destroy?.();
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/**
 * Proofread filing text via the on-device Proofreader API.
 * Output is provisional; the filing still requires human sign-off.
 */
export async function proofreadFiling(text: string): Promise<AiTextResult> {
  if (text.trim().length === 0) {
    return unavailable('No text provided to proofread.');
  }
  const factory = await requireCapability('proofreader', 'Proofreader');
  if (isUnavailable(factory)) return factory;
  let session: ProofreaderSessionLike | undefined;
  try {
    session = await withTimeout(
      factory.create({ expectedInputLanguages: ['en'] }) as Promise<ProofreaderSessionLike>,
      'Proofreader create',
    );
    const raw = await withTimeout(
      session.proofread(truncate(text)),
      'Proofreader proofread',
    );
    const corrected =
      typeof raw === 'string' ? raw : raw?.correctedInput ?? '';
    if (corrected.trim().length === 0) {
      return unavailable('Proofreader returned an empty result.');
    }
    return provisional(corrected);
  } catch (err) {
    return unavailable(
      `Proofreader failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    try {
      session?.destroy?.();
    } catch {
      /* ignore cleanup errors */
    }
  }
}
