import { createHash } from "node:crypto";
import type {
  IBMQuantumComputeClient,
  IBMQuantumJob,
} from "./ibm-quantum-client.js";

export interface IBMQuantumJobContract {
  readonly schemaVersion: "TSM-IBMQuantumJob-1.0";
  readonly workloadId: string;
  readonly workerId: string;
  readonly inputArtifactSha256: string;
  readonly circuitArtifactSha256: string;
  readonly authorityClass: "DERIVED";
  readonly outputPolicy: "quarantine";
  readonly primitive: "sampler";
  readonly backend: string;
  readonly apiVersion: "2026-04-15";
  readonly shots?: number;
  readonly maxRuntimeSeconds?: number;
  readonly tags?: readonly string[];
}

export interface ImmutableArtifactStore {
  readBytes(sha256: string): Promise<Uint8Array>;
}

export interface QuantumSubmissionLedger {
  create(record: {
    workloadId: string;
    workerId: string;
    inputArtifactSha256: string;
    circuitArtifactSha256: string;
    backend: string;
    status: "submitting";
    authorityClass: "DERIVED";
    outputPolicy: "quarantine";
  }): Promise<void>;
  markSubmitted(workloadId: string, jobId: string): Promise<void>;
  markSubmissionUnknown(workloadId: string, reasonCode: string): Promise<void>;
}

export interface IBMQuantumSubmissionReceipt {
  readonly workloadId: string;
  readonly provider: "ibm-quantum-compute-service";
  readonly apiVersion: "2026-04-15";
  readonly backend: string;
  readonly jobId: string;
  readonly remoteStatus: string;
  readonly inputArtifactSha256: string;
  readonly circuitArtifactSha256: string;
  readonly authorityClass: "DERIVED";
  readonly outputPolicy: "quarantine";
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseCircuits(bytes: Uint8Array): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("Circuit artifact must be valid JSON.");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < 1 ||
    parsed.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new Error("Circuit artifact must be a non-empty array of OpenQASM strings.");
  }
  return parsed as string[];
}

/**
 * Validates immutable inputs, records intent before the remote POST, and
 * quarantines all outputs. The caller must use a durable ledger implementation.
 */
export async function submitIBMQuantumWorkload(
  contract: IBMQuantumJobContract,
  dependencies: {
    client: IBMQuantumComputeClient;
    artifacts: ImmutableArtifactStore;
    ledger: QuantumSubmissionLedger;
  },
): Promise<IBMQuantumSubmissionReceipt> {
  if (
    contract.schemaVersion !== "TSM-IBMQuantumJob-1.0" ||
    contract.authorityClass !== "DERIVED" ||
    contract.outputPolicy !== "quarantine" ||
    contract.primitive !== "sampler" ||
    contract.apiVersion !== "2026-04-15"
  ) {
    throw new Error("IBM Quantum workload violates the supported policy contract.");
  }
  if (!/^[a-f0-9]{64}$/.test(contract.inputArtifactSha256)) {
    throw new Error("Input artifact SHA-256 is invalid.");
  }
  if (!/^[a-f0-9]{64}$/.test(contract.circuitArtifactSha256)) {
    throw new Error("Circuit artifact SHA-256 is invalid.");
  }

  const [inputBytes, circuitBytes] = await Promise.all([
    dependencies.artifacts.readBytes(contract.inputArtifactSha256),
    dependencies.artifacts.readBytes(contract.circuitArtifactSha256),
  ]);
  if (sha256(inputBytes) !== contract.inputArtifactSha256) {
    throw new Error("Input artifact hash mismatch.");
  }
  if (sha256(circuitBytes) !== contract.circuitArtifactSha256) {
    throw new Error("Circuit artifact hash mismatch.");
  }
  const circuits = parseCircuits(circuitBytes);

  await dependencies.ledger.create({
    workloadId: contract.workloadId,
    workerId: contract.workerId,
    inputArtifactSha256: contract.inputArtifactSha256,
    circuitArtifactSha256: contract.circuitArtifactSha256,
    backend: contract.backend,
    status: "submitting",
    authorityClass: "DERIVED",
    outputPolicy: "quarantine",
  });

  let job: IBMQuantumJob;
  try {
    job = await dependencies.client.submitSampler({
      backend: contract.backend,
      circuits,
      ...(contract.shots === undefined ? {} : { shots: contract.shots }),
      ...(contract.tags === undefined ? {} : { tags: contract.tags }),
    });
  } catch {
    // A POST can succeed remotely even if the response is lost. Do not retry.
    await dependencies.ledger.markSubmissionUnknown(
      contract.workloadId,
      "REMOTE_SUBMISSION_OUTCOME_UNKNOWN",
    );
    throw new Error(
      "IBM job submission outcome is unknown; reconcile remote jobs before retrying.",
    );
  }

  if (!job.id || typeof job.id !== "string") {
    await dependencies.ledger.markSubmissionUnknown(
      contract.workloadId,
      "MISSING_REMOTE_JOB_ID",
    );
    throw new Error("IBM response omitted the job ID; reconcile before retrying.");
  }

  await dependencies.ledger.markSubmitted(contract.workloadId, job.id);
  return {
    workloadId: contract.workloadId,
    provider: "ibm-quantum-compute-service",
    apiVersion: "2026-04-15",
    backend: contract.backend,
    jobId: job.id,
    remoteStatus: typeof job.status === "string" ? job.status : "Unknown",
    inputArtifactSha256: contract.inputArtifactSha256,
    circuitArtifactSha256: contract.circuitArtifactSha256,
    authorityClass: "DERIVED",
    outputPolicy: "quarantine",
  };
}
