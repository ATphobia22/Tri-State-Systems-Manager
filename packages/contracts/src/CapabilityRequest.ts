export interface CapabilityRequest<TInput = unknown> {
  capability: string;
  input: TInput;
  options?: {
    timeoutMs?: number;
    deterministic?: boolean;
    requireCitations?: boolean;
    requireProvenance?: boolean;
  };
}
