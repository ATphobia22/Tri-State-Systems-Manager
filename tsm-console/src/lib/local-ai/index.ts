/**
 * local-ai — on-device built-in AI module (Chrome Built-in AI Early Preview Program).
 *
 * Standalone: does not depend on `flood-sim/` or any other TSM subsystem.
 * Consumed either by mounting `<LocalAiPanel/>` or by calling the assistant
 * functions directly. All AI output is provisional, labeled, and fail-closed.
 */

export {
  getLocalAiCapabilities,
  type LocalAiApiStatus,
  type LocalAiCapability,
  type LocalAiCapabilityId,
  type LocalAiCapabilitiesReport,
} from './availability';

export {
  GOVERNING_AXIOM,
  PROVISIONAL_LABEL,
  AI_MODEL_NAME,
  MAX_INPUT_CHARS,
  explainFloodResult,
  askFloodplainQuestion,
  summarizeEvidencePacket,
  proofreadFiling,
  type FloodScenarioSummary,
  type EvidencePacketSummary,
  type AiTextResult,
} from './assistant';
