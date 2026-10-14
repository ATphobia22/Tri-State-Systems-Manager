/**
 * IBM Quantum Compute Service REST client for the Tri-State Systems Manager.
 *
 * Node.js 20+ (native fetch). This module is opt-in and never executes a job
 * until submitSampler() is explicitly called by an authorized worker.
 */
export type IBMQuantumRegion = "us" | "eu-de";
export type IBMQuantumPrimitive = "sampler" | "estimator";

export interface IBMQuantumConfig {
  readonly apiKey: string;
  readonly instanceCrn: string;
  readonly region: IBMQuantumRegion;
  readonly apiVersion: string;
  readonly timeoutMs: number;
}

export interface IBMQuantumJob {
  readonly id: string;
  readonly status?: string;
  readonly backend?: string;
  readonly program?: { readonly id?: string };
  readonly created?: string;
  readonly [key: string]: unknown;
}

export interface IBMQuantumSamplerRequest {
  readonly backend: string;
  readonly circuits: readonly string[];
  readonly shots?: number;
  readonly tags?: readonly string[];
}

export class IBMQuantumError extends Error {
  public constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "IBMQuantumError";
  }
}

interface IAMTokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
  readonly token_type?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadIBMQuantumConfig(
  env: NodeJS.ProcessEnv = process.env,
): IBMQuantumConfig {
  const apiKey = env.IBM_QUANTUM_API_KEY?.trim();
  const instanceCrn = env.IBM_QUANTUM_INSTANCE_CRN?.trim();
  const regionValue = env.IBM_QUANTUM_REGION ?? "us";
  const apiVersion = env.IBM_QUANTUM_API_VERSION ?? "2026-04-15";
  const timeoutMs = Number(env.IBM_QUANTUM_TIMEOUT_MS ?? "20000");

  if (!apiKey || !instanceCrn) {
    throw new Error(
      "IBM_QUANTUM_API_KEY and IBM_QUANTUM_INSTANCE_CRN are required.",
    );
  }
  if (regionValue !== "us" && regionValue !== "eu-de") {
    throw new Error("IBM_QUANTUM_REGION must be us or eu-de.");
  }
  if (!apiVersion || apiVersion.length > 32) {
    throw new Error("IBM_QUANTUM_API_VERSION is invalid.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300_000) {
    throw new Error("IBM_QUANTUM_TIMEOUT_MS must be between 1 and 300000.");
  }

  return {
    apiKey,
    instanceCrn,
    region: regionValue,
    apiVersion,
    timeoutMs,
  };
}

export class IBMQuantumComputeClient {
  private token: string | undefined;
  private tokenExpiresAt = 0;
  private tokenPromise: Promise<string> | undefined;

  public constructor(private readonly config: IBMQuantumConfig) {}

  private get baseUrl(): string {
    const host =
      this.config.region === "eu-de"
        ? "eu-de.quantum.cloud.ibm.com"
        : "quantum.cloud.ibm.com";
    return `https://${host}/api/v1/`;
  }

  private async acquireToken(): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const form = new URLSearchParams({
        grant_type: "urn:ibm:params:oauth:grant-type:apikey",
        apikey: this.config.apiKey,
      });
      const response = await fetch(
        "https://iam.cloud.ibm.com/identity/token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
          signal: controller.signal,
          redirect: "error",
        },
      );
      if (!response.ok) {
        throw new IBMQuantumError(
          "IBM IAM token acquisition failed.",
          response.status,
        );
      }
      const data: unknown = await response.json();
      if (
        !isRecord(data) ||
        typeof data.access_token !== "string" ||
        !data.access_token ||
        typeof data.expires_in !== "number" ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      ) {
        throw new IBMQuantumError("IBM IAM returned an invalid token response.");
      }
      const tokenData = data as unknown as IAMTokenResponse;
      this.token = tokenData.access_token;
      const refreshSeconds = Math.max(
        0,
        tokenData.expires_in - Math.min(60, tokenData.expires_in / 2),
      );
      this.tokenExpiresAt = Date.now() + refreshSeconds * 1000;
      return tokenData.access_token;
    } catch (error: unknown) {
      if (error instanceof IBMQuantumError) throw error;
      throw new IBMQuantumError("IBM IAM token request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getToken(forceRefresh = false): Promise<string> {
    if (forceRefresh) {
      this.token = undefined;
      this.tokenExpiresAt = 0;
    }
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = this.acquireToken();
    try {
      return await this.tokenPromise;
    } finally {
      this.tokenPromise = undefined;
    }
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    query?: URLSearchParams,
  ): Promise<T> {
    if (
      path.startsWith("/") ||
      path.split("/").some((part) => part === "." || part === "..")
    ) {
      throw new Error("IBM API path must be relative and safe.");
    }

    const url = new URL(path, this.baseUrl);
    if (query) url.search = query.toString();
    if (url.origin !== new URL(this.baseUrl).origin) {
      throw new Error("Unexpected IBM API origin.");
    }

    const execute = async (token: string): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );
      try {
        return await fetch(url, {
          method,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Service-CRN": this.config.instanceCrn,
            "IBM-API-Version": this.config.apiVersion,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          redirect: "error",
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let response = await execute(await this.getToken());
    if (response.status === 401 && method === "GET") {
      await response.body?.cancel();
      response = await execute(await this.getToken(true));
    }
    if (!response.ok) {
      const statusCode = response.status;
      await response.body?.cancel();
      throw new IBMQuantumError(
        `IBM Quantum request failed with HTTP ${statusCode}.`,
        statusCode,
      );
    }

    const data: unknown = await response.json().catch(() => {
      throw new IBMQuantumError("IBM Quantum returned invalid JSON.");
    });
    if (!isRecord(data) && !Array.isArray(data)) {
      throw new IBMQuantumError("IBM Quantum returned an unexpected JSON type.");
    }
    return data as T;
  }

  public listBackends<T = unknown>(): Promise<T> {
    return this.request<T>("GET", "backends");
  }

  public getBackendStatus<T = unknown>(backend: string): Promise<T> {
    if (!backend.trim() || backend.length > 200) {
      throw new Error("Backend identifier is invalid.");
    }
    return this.request<T>(
      "GET",
      `backends/${encodeURIComponent(backend)}/status`,
    );
  }

  public submitSampler(request: IBMQuantumSamplerRequest): Promise<IBMQuantumJob> {
    if (!request.backend.trim() || request.backend.length > 200) {
      throw new Error("Backend identifier is invalid.");
    }
    if (
      request.circuits.length === 0 ||
      request.circuits.some((circuit) => !circuit.trim())
    ) {
      throw new Error("At least one non-empty OpenQASM circuit is required.");
    }
    if (
      request.shots !== undefined &&
      (!Number.isSafeInteger(request.shots) ||
        request.shots < 1 ||
        request.shots > 10_000_000)
    ) {
      throw new Error("shots must be an integer between 1 and 10000000.");
    }
    if (
      request.tags &&
      (request.tags.length > 20 ||
        request.tags.some((tag) => !tag || tag.length > 128))
    ) {
      throw new Error("Tags must contain 1-20 non-empty strings of at most 128 characters.");
    }

    const pubs = request.circuits.map((circuit) =>
      request.shots === undefined
        ? [circuit]
        : [circuit, null, request.shots],
    );
    const body: Record<string, unknown> = {
      program_id: "sampler",
      backend: request.backend,
      params: { pubs, options: {}, version: 2 },
      ...(request.tags ? { tags: [...request.tags] } : {}),
    };

    // Never auto-retry POST: a transport failure can occur after job creation.
    return this.request<IBMQuantumJob>("POST", "jobs", body);
  }

  public getJob(jobId: string): Promise<IBMQuantumJob> {
    if (!jobId.trim() || jobId.length > 256) {
      throw new Error("Job identifier is invalid.");
    }
    return this.request<IBMQuantumJob>(
      "GET",
      `jobs/${encodeURIComponent(jobId)}`,
    );
  }

  public getJobResults<T = unknown>(jobId: string): Promise<T> {
    if (!jobId.trim() || jobId.length > 256) {
      throw new Error("Job identifier is invalid.");
    }
    return this.request<T>(
      "GET",
      `jobs/${encodeURIComponent(jobId)}/results`,
    );
  }

  public listJobs<T = unknown>(options: {
    limit?: number;
    offset?: number;
    pending?: boolean;
  } = {}): Promise<T> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new Error("limit must be an integer from 1 through 200.");
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error("offset must be a non-negative integer.");
    }
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (options.pending !== undefined) {
      query.set("pending", String(options.pending));
    }
    return this.request<T>("GET", "jobs", undefined, query);
  }
}
