import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEVEL5_SCHEMA_VERSION = 'tsm.level5.autonomy.v1';
export const AUTONOMY_MODES = Object.freeze({ OBSERVE: 'OBSERVE', PREDICT: 'PREDICT', PROPOSE: 'PROPOSE', APPROVE: 'APPROVE', EXECUTE: 'EXECUTE' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.TSM_AUTONOMY_DIR || path.join(__dirname, '../../.data');
const STORE_FILE = path.join(DATA_DIR, 'autonomy-state.json');
const MAX_PROPOSALS = 2048;
const MAX_TELEMETRY = 4096;
const MAX_COMMANDS = 2048;
const DEFAULT_FRESHNESS_MS = 15 * 60_000;

function fail(message, code = 'AUTONOMY_FAIL_CLOSED', status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
}
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}
function integrityHash(value) {
  return createHmac('sha256', 'tsm-level5-integrity').update(value, 'utf8').digest('hex');
}
function approvalSecret() {
  const value = String(process.env.TSM_AUTONOMY_APPROVAL_SECRET || process.env.TSM_SESSION_SECRET || '');
  if (value.length < 32) fail('TSM_AUTONOMY_APPROVAL_SECRET or TSM_SESSION_SECRET must contain at least 32 characters.', 'AUTONOMY_APPROVAL_SECRET_MISSING', 503);
  return value;
}
function approvalHmac(value) {
  return createHmac('sha256', approvalSecret()).update(value, 'utf8').digest('hex');
}
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadState() {
  ensureStore();
  if (!fs.existsSync(STORE_FILE)) return { proposals: [], approvals: [], executions: [] };
  const state = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  return {
    proposals: Array.isArray(state.proposals) ? state.proposals.slice(0, MAX_PROPOSALS) : [],
    approvals: Array.isArray(state.approvals) ? state.approvals.slice(0, MAX_PROPOSALS) : [],
    executions: Array.isArray(state.executions) ? state.executions.slice(0, MAX_COMMANDS) : [],
  };
}
function saveState(state) {
  ensureStore();
  const tmp = STORE_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STORE_FILE);
}
function trim(state) {
  state.proposals = state.proposals.slice(0, MAX_PROPOSALS);
  state.approvals = state.approvals.slice(0, MAX_PROPOSALS);
  state.executions = state.executions.slice(0, MAX_COMMANDS);
}
function normalizeTelemetry(readings, nowMs = Date.now()) {
  if (!Array.isArray(readings) || readings.length === 0 || readings.length > MAX_TELEMETRY) fail('telemetry must be a non-empty array with at most ' + MAX_TELEMETRY + ' readings.');
  return readings.map((reading, index) => {
    if (!reading || typeof reading !== 'object') fail('telemetry[' + index + '] must be an object.');
    const sensorId = String(reading.sensor_id || '').trim();
    const metric = String(reading.metric || '').trim();
    const observedAt = Date.parse(String(reading.observed_at || ''));
    const value = Number(reading.value);
    const quality = reading.quality == null ? 1 : Number(reading.quality);
    if (!sensorId || !metric || !Number.isFinite(observedAt) || !Number.isFinite(value)) fail('telemetry[' + index + '] has invalid sensor_id, metric, observed_at, or value.');
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) fail('telemetry[' + index + '] quality must be between 0 and 1.');
    const freshnessMs = Math.max(1_000, Number(reading.max_freshness_ms || DEFAULT_FRESHNESS_MS));
    return { sensor_id: sensorId, metric, observed_at: new Date(observedAt).toISOString(), value, unit: String(reading.unit || 'unknown'), quality, freshness_ms: freshnessMs, source_authority: String(reading.source_authority || 'UNSPECIFIED') };
  }).filter((reading) => nowMs - Date.parse(reading.observed_at) <= reading.freshness_ms);
}
function weightedMedian(values) {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + Math.max(0.0001, item.weight), 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += Math.max(0.0001, item.weight);
    if (cumulative >= total / 2) return item.value;
  }
  return sorted.at(-1)?.value ?? null;
}
function fuseTelemetry(readings, nowMs = Date.now()) {
  const normalized = normalizeTelemetry(readings, nowMs);
  const groups = new Map();
  for (const reading of normalized) {
    const bucket = groups.get(reading.metric) || [];
    bucket.push(reading);
    groups.set(reading.metric, bucket);
  }
  const fused = {};
  for (const [metric, group] of groups) {
    const values = group.map((reading) => ({
      value: reading.value,
      weight: reading.quality / Math.max(1, nowMs - Date.parse(reading.observed_at)) * 1000,
    }));
    const value = weightedMedian(values);
    const confidence = Math.min(1, group.reduce((sum, item) => sum + item.quality, 0) / Math.max(1, group.length));
    fused[metric] = {
      value,
      unit: group[0].unit,
      confidence,
      sensors: group.map((item) => item.sensor_id),
      source_authorities: [...new Set(group.map((item) => item.source_authority))],
    };
  }
  return fused;
}
function scenarioFactor(scenario) {
  const factors = {
    water_main_pressure_drop: 0.35,
    river_stage_rise: 0.25,
    grid_load_surge: 0.2,
    bridge_strain: 0.3,
    storm_surge: 0.4,
    rainfall_intensification: 0.3,
  };
  return factors[scenario] ?? 0.15;
}
function projectValue(value, scenario, hours, horizonHours) {
  const factor = scenarioFactor(scenario);
  return value * (1 + factor * Math.min(Math.max(hours, 0), horizonHours) / Math.max(1, horizonHours));
}
function buildActions(scenario, metric, projectedValue, threshold) {
  if (projectedValue < threshold) return [];
  const actionMap = {
    water_main_pressure_drop: { type: 'isolate_zone', target: metric, safety: 'simulation_only' },
    river_stage_rise: { type: 'issue_flood_response_draft', target: 'hydrologic_zone', safety: 'human_approval_required' },
    grid_load_surge: { type: 'prepare_load_shed_plan', target: 'grid_zone', safety: 'human_approval_required' },
    bridge_strain: { type: 'prepare_weight_restriction', target: 'bridge_asset', safety: 'human_approval_required' },
    storm_surge: { type: 'prepare_evacuation_draft', target: 'planning_zone', safety: 'human_approval_required' },
    rainfall_intensification: { type: 'prepare_stormwater_response', target: 'drainage_zone', safety: 'human_approval_required' },
  };
  return [actionMap[scenario] || { type: 'prepare_operator_review', target: metric, safety: 'human_approval_required' }];
}
export function evaluateLevel5({ telemetry, scenario = 'river_stage_rise', horizon_hours = 72, threshold = 1, target_time } = {}) {
  if (!Number.isInteger(horizon_hours) || horizon_hours < 1 || horizon_hours > 168) fail('horizon_hours must be an integer from 1 to 168.');
  const nowMs = Date.now();
  const fused = fuseTelemetry(telemetry, nowMs);
  const metric = Object.keys(fused)[0];
  if (!metric) fail('No fresh telemetry remained after freshness filtering.', 'AUTONOMY_TELEMETRY_STALE', 503);
  const baseline = fused[metric].value;
  const targetMs = target_time ? Date.parse(target_time) : nowMs + horizon_hours * 3600_000;
  if (!Number.isFinite(targetMs)) fail('target_time must be ISO-8601 when provided.');
  const projectedValue = projectValue(baseline, scenario, Math.max(0, (targetMs - nowMs) / 3600_000), horizon_hours);
  const actions = buildActions(scenario, metric, projectedValue, Number(threshold));
  const prediction = { scenario, horizon_hours, target_time: new Date(targetMs).toISOString(), metric, baseline, projected_value: projectedValue, threshold: Number(threshold), exceeded: actions.length > 0, confidence: fused[metric].confidence };
  const proposal = {
    proposal_id: 'L5-' + randomUUID(),
    schema_version: LEVEL5_SCHEMA_VERSION,
    created_at: new Date(nowMs).toISOString(),
    mode: AUTONOMY_MODES.PROPOSE,
    status: 'PENDING_HUMAN_APPROVAL',
    prediction,
    fused_state: fused,
    actions,
    governance: { authority_class: 'ASSISTANCE', governance_status: 'human_review_required', is_simulation_demo: true, physical_actuation: 'blocked_by_default', human_authorization_required: true },
  };
  proposal.integrity_sha256 = integrityHash(stableStringify(proposal));
  const state = loadState();
  state.proposals.unshift(proposal);
  trim(state);
  saveState(state);
  return proposal;
}
export function listLevel5Proposals(limit = 50) {
  return loadState().proposals.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
}
function verifyProposalIntegrity(proposal) {
  const clone = { ...proposal };
  const expected = clone.integrity_sha256;
  delete clone.integrity_sha256;
  if (expected !== integrityHash(stableStringify(clone))) fail('Autonomy proposal integrity check failed.');
}
export function approveLevel5Proposal(proposalId, actorSubject, reason) {
  const subject = String(actorSubject || '').trim();
  const reviewReason = String(reason || '').trim();
  if (!subject || subject.length < 3) fail('Authenticated reviewer identity is required.', 'AUTONOMY_REVIEWER_REQUIRED', 403);
  if (reviewReason.length < 10) fail('Approval reason must contain at least 10 characters.', 'AUTONOMY_REVIEW_REASON_REQUIRED');
  const state = loadState();
  const proposal = state.proposals.find((item) => item.proposal_id === proposalId);
  if (!proposal) fail('Autonomy proposal not found.', 'AUTONOMY_PROPOSAL_NOT_FOUND', 404);
  verifyProposalIntegrity(proposal);
  const existing = state.approvals.find((item) => item.proposal_id === proposalId && item.status === 'APPROVED');
  if (existing) return existing;
  const approval = {
    approval_id: 'L5A-' + randomUUID(),
    proposal_id: proposalId,
    reviewer_identity: subject,
    reason: reviewReason,
    reviewed_at: new Date().toISOString(),
    status: 'APPROVED',
  };
  approval.approval_hmac = approvalHmac(stableStringify(approval));
  state.approvals.unshift(approval);
  trim(state);
  saveState(state);
  return approval;
}
function executionEnabled() {
  return String(process.env.TSM_AUTONOMY_EXECUTION_ENABLED || '').toLowerCase() === 'true';
}
function actuatorMode() {
  return String(process.env.TSM_ACTUATOR_MODE || 'disabled').toLowerCase();
}
function allowedActions() {
  return new Set(String(process.env.TSM_ACTUATOR_ACTION_ALLOWLIST || '').split(',').map((item) => item.trim()).filter(Boolean));
}
export async function executeLevel5Proposal(proposalId, actorSubject) {
  const state = loadState();
  const proposal = state.proposals.find((item) => item.proposal_id === proposalId);
  if (!proposal) fail('Autonomy proposal not found.', 'AUTONOMY_PROPOSAL_NOT_FOUND', 404);
  verifyProposalIntegrity(proposal);
  const approval = state.approvals.find((item) => item.proposal_id === proposalId && item.status === 'APPROVED');
  if (!approval) fail('Human approval is required before execution.', 'AUTONOMY_HUMAN_APPROVAL_REQUIRED', 403);
  if (approval.approval_hmac !== approvalHmac(stableStringify({ approval_id: approval.approval_id, proposal_id: approval.proposal_id, reviewer_identity: approval.reviewer_identity, reason: approval.reason, reviewed_at: approval.reviewed_at, status: approval.status }))) {
    fail('Approval integrity check failed.');
  }
  if (String(process.env.TSM_AUTONOMY_KILL_SWITCH || '').toLowerCase() === 'true') fail('Autonomy kill switch is active.', 'AUTONOMY_KILL_SWITCH_ACTIVE', 503);
  if (!executionEnabled()) fail('Physical execution is disabled. Enable only after an approved actuator integration review.', 'AUTONOMY_EXECUTION_DISABLED', 503);
  const mode = actuatorMode();
  if (mode === 'disabled') fail('No actuator adapter is configured.', 'ACTUATOR_NOT_CONFIGURED', 503);
  const allowlist = allowedActions();
  for (const action of proposal.actions || []) if (!allowlist.has(action.type)) fail('Action is not on the configured actuator allow-list: ' + action.type, 'ACTUATOR_ACTION_NOT_ALLOWLISTED', 403);
  const existing = state.executions.find((item) => item.proposal_id === proposalId && item.status.startsWith('EXECUTED'));
  if (existing) return existing;
  const execution = { execution_id: 'L5E-' + randomUUID(), proposal_id: proposalId, actor_subject: String(actorSubject || ''), executed_at: new Date().toISOString(), mode, status: 'SIMULATION_ONLY' };
  if (mode === 'simulation') execution.status = 'EXECUTED_SIMULATION';
  else if (mode === 'http') fail('Generic HTTP actuator execution is intentionally prohibited; install a dedicated reviewed adapter.', 'ACTUATOR_HTTP_ADAPTER_UNIMPLEMENTED', 501);
  else fail('Unsupported actuator mode: ' + mode, 'ACTUATOR_MODE_UNSUPPORTED');
  state.executions.unshift(execution);
  trim(state);
  saveState(state);
  return execution;
}
export function autonomyStatus() {
  const killSwitch = String(process.env.TSM_AUTONOMY_KILL_SWITCH || '').toLowerCase() === 'true';
  const mode = actuatorMode();
  return {
    schema_version: LEVEL5_SCHEMA_VERSION,
    autonomy_ladder: { current: 'S2_PRESCRIBED_AGENCY', execution_target: 'S3_SUPERVISED_AGENCY' },
    modes: AUTONOMY_MODES,
    physical_actuation_enabled: executionEnabled() && mode !== 'disabled' && !killSwitch,
    actuator_mode: mode,
    kill_switch_active: killSwitch,
    allowlisted_action_count: allowedActions().size,
    ...Object.fromEntries(Object.entries(loadState()).map(([key, value]) => [key.replace('_count', '_count'), value.length])),
    safety_boundary: 'No regulatory determination or physical actuation occurs without explicit human authorization and a reviewed actuator integration.',
  };
}
