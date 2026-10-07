export interface ProviderConfig {
  name: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ProviderResponse {
  ok: boolean;
  status: number;
  body: string;
}

export interface Provider {
  readonly name: string;
  request(path: string, init?: RequestInit): Promise<ProviderResponse>;
}

export class HttpProvider implements Provider {
  public readonly name: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  public constructor(config: ProviderConfig) {
    this.name = config.name;
    this.baseUrl = config.baseUrl ?? "";
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  public async request(path: string, init: RequestInit = {}): Promise<ProviderResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
      return { ok: response.ok, status: response.status, body: await response.text() };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  public register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  public get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  public names(): string[] {
    return [...this.providers.keys()];
  }
}
