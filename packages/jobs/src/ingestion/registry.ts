/**
 * Adapter registry for the ingestion worker framework.
 *
 * Adapters are looked up by name; an unknown name is a lookup miss, not an
 * exception — the worker turns it into an UNAVAILABLE result with a reason.
 * Registering two adapters under the same name is a programming error and
 * fails loudly at registration time.
 */
import type { AssetAdapter } from '../../../contracts/src/IngestionManifest.js';

export class AdapterRegistry {
  readonly #adapters = new Map<string, AssetAdapter>();

  register(adapter: AssetAdapter): void {
    if (this.#adapters.has(adapter.name)) {
      throw new Error(`Adapter already registered: ${adapter.name}`);
    }
    this.#adapters.set(adapter.name, adapter);
  }

  get(name: string): AssetAdapter | undefined {
    return this.#adapters.get(name);
  }

  has(name: string): boolean {
    return this.#adapters.has(name);
  }

  names(): readonly string[] {
    return [...this.#adapters.keys()];
  }

  list(): readonly AssetAdapter[] {
    return [...this.#adapters.values()];
  }
}
