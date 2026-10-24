export type SearchDomain = "evidence" | "catalog" | "nfhl" | "gage" | "parcel" | "docs";

export interface SearchQuery {
  readonly q: string;
  readonly domain: SearchDomain;
  readonly limit?: number;
  readonly jurisdiction?: string;
}

export interface SearchHit {
  readonly id: string;
  readonly domain: SearchDomain;
  readonly title: string;
  readonly snippet: string;
  readonly score: number;
  readonly uri?: string;
  readonly metadata?: Record<string, string>;
}

export interface SearchResult {
  readonly query: SearchQuery;
  readonly hits: SearchHit[];
  readonly tookMs: number;
  readonly disclaimer: string;
}

const DISCLAIMER =
  "Search results inform operators. They are not FEMA determinations, surveys, or legal advice. Human authority remains final.";

export class MemorySearchIndex {
  private readonly docs: SearchHit[] = [];

  add(hit: SearchHit): void {
    this.docs.push(hit);
  }

  search(query: SearchQuery): SearchResult {
    const start = Date.now();
    const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean);
    const limit = query.limit ?? 20;
    const hits = this.docs
      .filter((d) => d.domain === query.domain)
      .map((d) => {
        const hay = `${d.title} ${d.snippet}`.toLowerCase();
        const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { ...d, score };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { query, hits, tookMs: Date.now() - start, disclaimer: DISCLAIMER };
  }
}

export function createEmptyIndex(): MemorySearchIndex {
  return new MemorySearchIndex();
}

export const SEARCH_PACKAGE_VERSION = "1.0.0" as const;
