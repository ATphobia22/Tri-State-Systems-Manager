export interface CapabilityResult<TOutput = unknown> {
  success: boolean;
  output?: TOutput;
  error?: string;
  provider: string;
  traceId: string;
}
