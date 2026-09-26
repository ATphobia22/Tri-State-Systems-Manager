/**
 * local-ai/skills — expert skill packs for the on-device AI assistant.
 *
 * Each pack is a static JSON bundle (`./skills/<domain>.json`) containing:
 * - an expert system-prompt preamble (model-general guidance), which always
 *   embeds GOVERNING_AXIOM verbatim and the provisional-output requirement;
 * - `repo_grounded_facts`: reference knowledge verified against the TSM
 *   repository only — every statement names its source file;
 * - `hard_rules`: domain-specific prohibitions (never invent data, etc.);
 * - `disclaimers`, `keywords` (for the router), and `not_built`
 *   (capabilities explicitly NOT grounded — never faked).
 *
 * Zero network: packs are bundled static data imported at build time.
 * Nothing here fetches, and routing is a deterministic keyword scorer
 * (no randomness; ties break by pack registration order).
 */

import codingPack from './coding.json';
import designPack from './design.json';
import engineeringPack from './engineering.json';
import geologyPack from './geology.json';
import geotechnicalPack from './geotechnical.json';
import grantsPack from './grants.json';
import hydrologyPack from './hydrology.json';
import legalPack from './legal.json';
import mappingPack from './mapping.json';
import mathematicsPack from './mathematics.json';
import meteorologyPack from './meteorology.json';
import regulatoryPack from './regulatory.json';
import sciencePack from './science.json';

/** One repository-verified reference fact bundled with a skill pack. */
export interface RepoGroundedFact {
  /** The verified statement. Must name only facts checked against `source`. */
  statement: string;
  /** Repo-relative path of the file the statement was verified against. */
  source: string;
  /** Provenance label from the repo taxonomy (e.g. MODELED, OBSERVED). */
  provenance: string;
}

/** A single expert skill pack (one domain). */
export interface SkillPack {
  id: string;
  domain: string;
  version: string;
  sources: string[];
  expert_role: string;
  preamble: string;
  repo_grounded_facts: RepoGroundedFact[];
  hard_rules: string[];
  disclaimers: string[];
  keywords: string[];
  not_built: string[];
}

/**
 * Pack registration order. This order is the fixed tie-breaker for the
 * router: among packs with equal keyword scores, the earlier pack wins.
 */
const SKILL_PACKS: SkillPack[] = [
  engineeringPack as unknown as SkillPack,
  hydrologyPack as unknown as SkillPack,
  codingPack as unknown as SkillPack,
  designPack as unknown as SkillPack,
  mappingPack as unknown as SkillPack,
  geologyPack as unknown as SkillPack,
  meteorologyPack as unknown as SkillPack,
  legalPack as unknown as SkillPack,
  sciencePack as unknown as SkillPack,
  mathematicsPack as unknown as SkillPack,
  geotechnicalPack as unknown as SkillPack,
  regulatoryPack as unknown as SkillPack,
  grantsPack as unknown as SkillPack,
];

const PACK_BY_ID = new Map<string, SkillPack>(
  SKILL_PACKS.map((pack) => [pack.id, pack]),
);

/** Every registered skill pack, in registration order. */
export function listSkillPacks(): SkillPack[] {
  return [...SKILL_PACKS];
}

/** Look up a pack by id; undefined when unknown. */
export function getSkillPack(id: string): SkillPack | undefined {
  return PACK_BY_ID.get(id);
}

const MAX_ROUTED_PACKS = 3;

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/**
 * Deterministic keyword router: scores each pack by total keyword
 * occurrences (case-insensitive substring match) in the query, sorts by
 * score descending with registration order as the fixed tie-breaker, and
 * returns up to MAX_ROUTED_PACKS packs with score > 0.
 *
 * No randomness: the same query always routes to the same packs in the
 * same order. When no keyword matches, falls back to the science pack
 * (general evidence-reasoning) so the copilot always has grounded context.
 */
export function routeQuery(query: string): SkillPack[] {
  const normalized = query.toLowerCase();
  const scored = SKILL_PACKS.map((pack, index) => {
    let score = 0;
    for (const keyword of pack.keywords) {
      score += countOccurrences(normalized, keyword.toLowerCase());
    }
    return { pack, score, index };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_ROUTED_PACKS)
    .map((entry) => entry.pack);
  if (scored.length > 0) return scored;
  const fallback = PACK_BY_ID.get('science');
  return fallback ? [fallback] : [];
}

const LEGAL_PACK_ID = 'legal';

/** Id of the legal skill pack (its disclaimer must be forced into outputs). */
export function legalPackId(): string {
  return LEGAL_PACK_ID;
}

/**
 * Assemble the skill-pack contribution to a system prompt: expert preambles,
 * then the repo-grounded facts with their source files, then hard rules.
 * Deterministic: follows the order of the `packs` array.
 */
export function buildSkillContext(packs: SkillPack[]): string {
  if (packs.length === 0) return '';
  const parts: string[] = ['[Expert skill packs — repo-grounded reference]'];
  for (const pack of packs) {
    parts.push(`\n## ${pack.domain} pack (v${pack.version})`);
    parts.push(pack.preamble);
    parts.push('\nRepo-grounded facts (verified against the TSM repository):');
    for (const fact of pack.repo_grounded_facts) {
      parts.push(
        `- [${fact.provenance} | source: ${fact.source}] ${fact.statement}`,
      );
    }
    parts.push('Hard rules:');
    for (const rule of pack.hard_rules) {
      parts.push(`- ${rule}`);
    }
  }
  return parts.join('\n');
}
