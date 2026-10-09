// @tsm/plugin-engineering — UACF plugin scaffold (v0.1.0).
// Declares the plugin manifest only. No behavior is wired: every capability
// throws fail-closed until an operator configures the plugin.

export interface PluginManifest {
  name: string;
  version: string;
  capabilities: string[];
  status: 'scaffold';
}

export const manifest: PluginManifest = {
  name: '@tsm/plugin-engineering',
  version: '0.1.0',
  capabilities: ["deterministic-kernels", "solver-envelopes", "evidence-pipeline"],
  status: 'scaffold',
};

function notConfigured(capability: string): never {
  throw new Error(`@tsm/plugin-engineering: capability '${capability}' is not configured (fail-closed).`);
}

export function invoke(capability: string, _input: unknown): never {
  if (!manifest.capabilities.includes(capability)) {
    throw new Error(`@tsm/plugin-engineering: unknown capability '${capability}'.`);
  }
  return notConfigured(capability);
}

export default manifest;
