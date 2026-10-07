export interface SearchQuery {
  text: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, string>;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
  url?: string;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  query: string;
}

export interface SearchBackend {
  search(query: SearchQuery): Promise<SearchResult>;
}

export class InMemorySearch implements SearchBackend {
  private readonly documents: SearchHit[] = [];

  public index(documents: SearchHit[]): void {
    this.documents.push(...documents);
  }

  public async search(query: SearchQuery): Promise<SearchResult> {
    const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = this.documents
      .map((doc) => {
        const haystack = `${doc.title} ${doc.snippet}`.toLowerCase();
        const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
        return { doc, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.doc.score - a.doc.score);
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;
    const page = scored.slice(offset, offset + limit);
    return {
      hits: page.map(({ doc, score }) => ({ ...doc, score: doc.score + score })),
      total: scored.length,
      query: query.text,
    };
  }
}
