/**
 * local-ai/availability — feature detection for Chrome's built-in (on-device) AI.
 *
 * Covers the Prompt API (`LanguageModel`), Summarizer, Proofreader, and Writer.
 * Rules:
 * - Every global access is guarded (`typeof self !== 'undefined'`, property
 *   existence checks). This function MUST NEVER throw, including on iOS
 *   WKWebView and other browsers that lack these APIs.
 * - No network calls. Chrome may download the on-device model itself; that is
 *   browser-internal and never a `fetch()` from this module.
 * - No websockets. This module is 100% local.
 */

export type LocalAiApiStatus = 'available' | 'downloading' | 'unavailable';

export type LocalAiCapabilityId = 'prompt' | 'summarizer' | 'proofreader' | 'writer';

export interface LocalAiCapability {
  id: LocalAiCapabilityId;
  /** e.g. 'Prompt API (on-device Gemma)' */
  displayName: string;
  status: LocalAiApiStatus;
  /** Human-readable reason for the status. */
  reason: string;
}

export interface LocalAiCapabilitiesReport {
  capabilities: Record<LocalAiCapabilityId, LocalAiCapability>;
  /**
   * 'available' when the Prompt API is ready (the entry point for the AI
   * engineer copilot). 'downloading' when a model is still fetching.
   * Otherwise 'unavailable'.
   */
  overall: LocalAiApiStatus;
  reason: string;
}

const CAPABILITY_GLOBALS: Record<
  LocalAiCapabilityId,
  { globalName: string; displayName: string }
> = {
  prompt: { globalName: 'LanguageModel', displayName: 'Prompt API (on-device Gemma)' },
  summarizer: { globalName: 'Summarizer', displayName: 'Summarizer API' },
  proofreader: { globalName: 'Proofreader', displayName: 'Proofreader API' },
  writer: { globalName: 'Writer', displayName: 'Writer API' },
};

interface AvailabilityLike {
  availability: (options?: unknown) => Promise<unknown>;
}

function getBuiltinFactory(globalName: string): AvailabilityLike | undefined {
  // Guarded: `self` exists in window and worker scopes; absent in Node/SSR and
  // older environments. Never reference it unguarded.
  const scope: unknown =
    typeof self !== 'undefined' ? (self as unknown) : undefined;
  if (!scope || typeof scope !== 'object' || scope === null) return undefined;
  const candidate = (scope as Record<string, unknown>)[globalName];
  if (!candidate || typeof candidate !== 'object' || candidate === null) {
    return undefined;
  }
  const availability = (candidate as Record<string, unknown>)['availability'];
  if (typeof availability !== 'function') return undefined;
  return candidate as AvailabilityLike;
}

/**
 * Maps the browser's availability token to the three-state report.
 * Handles both the current spec tokens ('available' | 'downloading' |
 * 'downloadable' | 'unavailable') and pre-standard tokens
 * ('readily' | 'after-download' | 'no').
 */
function mapAvailability(raw: unknown): { status: LocalAiApiStatus; reason: string } {
  switch (raw) {
    case 'available':
    case 'readily':
      return { status: 'available', reason: 'On-device model is ready.' };
    case 'downloading':
      return { status: 'downloading', reason: 'On-device model is downloading.' };
    case 'after-download':
    case 'downloadable':
      return {
        status: 'downloading',
        reason: 'On-device model will download on first use (device storage and Chrome opt-in required).',
      };
    default:
      return {
        status: 'unavailable',
        reason: `API reported "${String(raw)}".`,
      };
  }
}

async function probeCapability(
  id: LocalAiCapabilityId,
): Promise<LocalAiCapability> {
  const { globalName, displayName } = CAPABILITY_GLOBALS[id];
  try {
    const factory = getBuiltinFactory(globalName);
    if (!factory) {
      return {
        id,
        displayName,
        status: 'unavailable',
        reason: `${globalName} is not exposed here. Needs Chrome (desktop/Android) with built-in AI enabled; iOS WKWebView and other browsers are currently unsupported.`,
      };
    }
    const raw = await factory.availability();
    const mapped = mapAvailability(raw);
    return { id, displayName, ...mapped };
  } catch {
    return {
      id,
      displayName,
      status: 'unavailable',
      reason: `${globalName}.availability() failed.`,
    };
  }
}

/**
 * Probe all built-in AI capabilities. Never throws; every failure mode maps to
 * 'unavailable' with a human-readable reason.
 */
export async function getLocalAiCapabilities(): Promise<LocalAiCapabilitiesReport> {
  try {
    const ids = Object.keys(CAPABILITY_GLOBALS) as LocalAiCapabilityId[];
    const probed = await Promise.all(ids.map((id) => probeCapability(id)));
    const capabilities = {} as Record<LocalAiCapabilityId, LocalAiCapability>;
    for (const cap of probed) capabilities[cap.id] = cap;

    const prompt = capabilities.prompt;
    let overall: LocalAiApiStatus = 'unavailable';
    let reason = 'Built-in AI is unavailable in this browser.';
    if (prompt.status === 'available') {
      overall = 'available';
      reason = 'On-device Prompt API is ready.';
    } else if (probed.some((c) => c.status === 'downloading')) {
      overall = 'downloading';
      reason = 'On-device model is still downloading or will download on first use.';
    }
    return { capabilities, overall, reason };
  } catch {
    // Absolute last resort: this function is contractually non-throwing.
    const capabilities = {} as Record<LocalAiCapabilityId, LocalAiCapability>;
    for (const id of Object.keys(CAPABILITY_GLOBALS) as LocalAiCapabilityId[]) {
      capabilities[id] = {
        id,
        displayName: CAPABILITY_GLOBALS[id].displayName,
        status: 'unavailable',
        reason: 'Capability probe failed unexpectedly.',
      };
    }
    return {
      capabilities,
      overall: 'unavailable',
      reason: 'Built-in AI probe failed unexpectedly.',
    };
  }
}
