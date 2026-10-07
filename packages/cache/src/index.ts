export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  ttlMs?: number;
}

export class MemoryCache<T = unknown> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;

  public constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public set(key: string, value: T, options: CacheOptions = {}): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + (options.ttlMs ?? this.defaultTtlMs),
    });
  }

  public get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): boolean {
    return this.entries.delete(key);
  }

  public clear(): void {
    this.entries.clear();
  }

  public async getOrSet(key: string, loader: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    this.set(key, value, options);
    return value;
  }
}
