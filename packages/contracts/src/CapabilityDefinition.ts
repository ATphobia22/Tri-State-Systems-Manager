export interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  supportsStreaming: boolean;
  supportsBatching: boolean;
}
