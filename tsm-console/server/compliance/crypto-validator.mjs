import crypto from 'node:crypto';

export const ZERO_HASH = '0'.repeat(64);

function canonicalNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError('telemetry value must be finite');
  return number.toFixed(3);
}
function canonicalTimestamp(value) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw new TypeError('telemetry timestamp must be valid');
  return timestamp.toISOString();
}
export function canonicalizeTelemetryPacket(packet, parentHash = ZERO_HASH) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new TypeError('telemetry packet must be an object');
  const stationId = String(packet.station_id || '').trim();
  const operatorId = String(packet.operator_id || '').trim();
  if (!stationId || !operatorId) throw new TypeError('station_id and operator_id are required');
  if (!/^[a-f0-9]{64}$/.test(parentHash)) throw new TypeError('parentHash must be lowercase SHA-256 hex');
  const timestampIso = canonicalTimestamp(packet.timestamp);
  const nonce = /^[a-f0-9]{32}$/.test(String(packet.nonce || '')) ? String(packet.nonce) : crypto.randomBytes(16).toString('hex');
  const canonical = [stationId, timestampIso, canonicalNumber(packet.value), operatorId, parentHash, nonce].join('|');
  return { station_id: stationId, operator_id: operatorId, value: Number(packet.value), timestamp_iso: timestampIso, nonce, parent_hash: parentHash, canonical };
}
export function signTelemetryPacket(packet, parentHash = ZERO_HASH) {
  const normalized = canonicalizeTelemetryPacket(packet, parentHash);
  const sha256Hash = crypto.createHash('sha256').update(normalized.canonical, 'utf8').digest('hex');
  return { ...packet, ...normalized, sha256_hash: sha256Hash };
}
export function verifyTelemetryPacket(signedPacket) {
  if (!signedPacket || !/^[a-f0-9]{64}$/.test(String(signedPacket.sha256_hash || ''))) return false;
  try {
    const normalized = canonicalizeTelemetryPacket(signedPacket, String(signedPacket.parent_hash || ''));
    const computed = crypto.createHash('sha256').update(normalized.canonical, 'utf8').digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signedPacket.sha256_hash, 'hex'));
  } catch { return false; }
}
