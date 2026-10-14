import { describe, expect, it } from "vitest";
import { IBMQuantumComputeClient, loadIBMQuantumConfig } from "../../integrations/quantum/ibm-quantum-client.js";

describe("IBM Quantum configuration", () => {
  it("requires credentials", () => {
    expect(() => loadIBMQuantumConfig({})).toThrow();
  });
  it("rejects unsupported regions", () => {
    expect(() => loadIBMQuantumConfig({ IBM_QUANTUM_API_KEY: "key", IBM_QUANTUM_INSTANCE_CRN: "crn", IBM_QUANTUM_REGION: "invalid" })).toThrow();
  });
  it("validates job inputs before network access", async () => {
    const client = new IBMQuantumComputeClient({ apiKey: "key", instanceCrn: "crn", region: "us", apiVersion: "2026-04-15", timeoutMs: 1000 });
    await expect(client.submitSampler({ backend: "backend", circuits: [] })).rejects.toThrow();
    await expect(client.submitSampler({ backend: "backend", circuits: ["OPENQASM 3.0;"], shots: 0 })).rejects.toThrow();
  });
});
