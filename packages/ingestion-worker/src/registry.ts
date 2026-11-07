import type { AssetAdapter } from './types.js';

export class AdapterRegistry {
  private readonly adapters = new Map<string, AssetAdapter>();

  register(adapter: AssetAdapter): void {
    if (this.adapters.has(adapter.type)) {
      throw new Error(`Adapter already registered: ${adapter.type}`);
    }
    this.adapters.set(adapter.type, adapter);
  }

  find(path: string): AssetAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canProcess(path)) return adapter;
    }
    return undefined;
  }

  listTypes(): string[] {
    return [...this.adapters.keys()].sort();
  }
}
