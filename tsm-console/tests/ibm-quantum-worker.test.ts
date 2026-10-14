import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { IBMQuantumComputeClient } from "../../integrations/quantum/ibm-quantum-client.js";
import { submitIBMQuantumWorkload } from "../../integrations/quantum/ibm-quantum-worker.js";

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("TSM IBM Quantum worker", () => {
  it("verifies immutable artifacts and quarantines submitted work", async () => {
    const input = new TextEncoder().encode("{\"case\":\"screening\"}");
    const circuit = new TextEncoder().encode(JSON.stringify(["OPENQASM 3.0;"]));
    const inputHash = digest(input);
    const circuitHash = digest(circuit);
    const ledger = {
      create: vi.fn().mockResolvedValue(undefined),
      markSubmitted: vi.fn().mockResolvedValue(undefined),
      markSubmissionUnknown: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      submitSampler: vi.fn().mockResolvedValue({ id: "job-123", status: "Queued" }),
    } as unknown as IBMQuantumComputeClient;

    const receipt = await submitIBMQuantumWorkload({
      schemaVersion: "TSM-IBMQuantumJob-1.0",
      workloadId: "workload-1",
      workerId: "worker-1",
      inputArtifactSha256: inputHash,
      circuitArtifactSha256: circuitHash,
      authorityClass: "DERIVED",
      outputPolicy: "quarantine",
      primitive: "sampler",
      backend: "approved-backend",
      apiVersion: "2026-04-15",
      shots: 128,
    }, {
      client,
      artifacts: {
        readBytes: vi.fn(async (hash: string) => hash === inputHash ? input : circuit),
      },
      ledger,
    });

    expect(receipt.jobId).toBe("job-123");
    expect(receipt.outputPolicy).toBe("quarantine");
    expect(ledger.create).toHaveBeenCalledOnce();
    expect(ledger.markSubmitted).toHaveBeenCalledWith("workload-1", "job-123");
  });

  it("rejects a mismatched artifact hash before submitting", async () => {
    const ledger = {
      create: vi.fn(),
      markSubmitted: vi.fn(),
      markSubmissionUnknown: vi.fn(),
    };
    const client = {
      submitSampler: vi.fn(),
    } as unknown as IBMQuantumComputeClient;
    await expect(submitIBMQuantumWorkload({
      schemaVersion: "TSM-IBMQuantumJob-1.0",
      workloadId: "workload-2",
      workerId: "worker-1",
      inputArtifactSha256: "a".repeat(64),
      circuitArtifactSha256: "b".repeat(64),
      authorityClass: "DERIVED",
      outputPolicy: "quarantine",
      primitive: "sampler",
      backend: "approved-backend",
      apiVersion: "2026-04-15",
    }, {
      client,
      artifacts: { readBytes: vi.fn(async () => new TextEncoder().encode("wrong")) },
      ledger,
    })).rejects.toThrow("Input artifact hash mismatch.");
    expect(client.submitSampler).not.toHaveBeenCalled();
  });
});
