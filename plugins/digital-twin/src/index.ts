// @tsm/plugin-digital-twin — UACF plugin scaffold (v0.1.0).
// Declares the plugin manifest only. No behavior is wired: every capability
// throws fail-closed until an operator configures the plugin.

export interface PluginManifest {
  name: string;
  version: string;
  capabilities: string[];
  status: 'scaffold';
}

export const manifest: PluginManifest = {
  name: '@tsm/plugin-digital-twin',
  version: '0.1.0',
  capabilities: ["twin-layer-registration", "lod-gating", "provenance-overlay"],
  status: 'scaffold',
};

function notConfigured(capability: string): never {
  throw new Error(`@tsm/plugin-digital-twin: capability '${capability}' is not configured (fail-closed).`);
}

export function invoke(capability: string, _input: unknown): never {
  if (!manifest.capabilities.includes(capability)) {
    throw new Error(`@tsm/plugin-digital-twin: unknown capability '${capability}'.`);
  }
  return notConfigured(capability);
}

export default manifest;
