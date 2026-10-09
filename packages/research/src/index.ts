export interface ResearchSource { readonly id: string; readonly url: string; readonly title?: string; readonly retrievedAt: string; readonly sha256?: string }
export interface ResearchClaim { readonly id: string; readonly text: string; readonly sourceIds: readonly string[]; readonly confidence: 'high' | 'medium' | 'low' | 'unverified' }
export interface ResearchResult { readonly query: string; readonly sources: readonly ResearchSource[]; readonly claims: readonly ResearchClaim[]; readonly limitations: readonly string[] }

/** Deterministic structural validator. Retrieval and synthesis are intentionally injected. */
export function validateResearchResult(result: ResearchResult): readonly string[] {
  const errors: string[] = [];
  const ids = new Set(result.sources.map((source) => source.id));
  if (!result.query.trim()) errors.push('query must not be empty');
  for (const source of result.sources) {
    try { const url = new URL(source.url); if (url.protocol !== 'https:' && url.protocol !== 'http:') errors.push(`source ${source.id} has an unsupported URL scheme`); }
    catch { errors.push(`source ${source.id} has an invalid URL`); }
    if (!source.id.trim()) errors.push('source id must not be empty');
  }
  for (const claim of result.claims) {
    if (!claim.text.trim()) errors.push(`claim ${claim.id} has empty text`);
    for (const sourceId of claim.sourceIds) if (!ids.has(sourceId)) errors.push(`claim ${claim.id} references missing source ${sourceId}`);
    if (claim.sourceIds.length === 0 && claim.confidence !== 'unverified') errors.push(`claim ${claim.id} has no sources but is not marked unverified`);
  }
  return errors;
}
