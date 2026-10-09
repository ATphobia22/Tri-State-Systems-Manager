/**
 * Local-first research scaffold. No external paid APIs by default.
 * Deep retrieval must go through providers/local + human-gated S2 tools.
 */

export interface ResearchPlan {
  readonly query: string;
  readonly steps: string[];
}

export function planResearch(query: string): ResearchPlan {
  return {
    query,
    steps: [
      'normalize query',
      'search local evidence ledger',
      'search local docs/grants/regulatory packs',
      'synthesize with citations',
      'require human review before regulatory use',
    ],
  };
}

export function assertNoSilentRegulatoryClaim(text: string): { ok: boolean; reason: string } {
  const banned = /\b(LOMA (approved|issued)|FEMA (approved|denied)|grant awarded)\b/i;
  if (banned.test(text)) {
    return {
      ok: false,
      reason: 'FAIL_CLOSED: research output must not assert regulatory outcomes without documentary proof',
    };
  }
  return { ok: true, reason: 'ok' };
}
