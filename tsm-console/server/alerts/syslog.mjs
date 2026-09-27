import crypto from 'node:crypto';

const SYSLOG_PATTERN = /^<(?<priority>\d{1,3})>(?:(?<version>\d) )?(?<timestamp>[^ ]+(?: [^ ]+){0,2}) (?<hostname>[^ ]+) (?<message>.*)$/;
const SEVERITY = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG'];
const recentEvents = new Map();

function prune(now = Date.now()) {
  for (const [key, timestamp] of recentEvents) if (now - timestamp > 300_000) recentEvents.delete(key);
  while (recentEvents.size > 4096) recentEvents.delete(recentEvents.keys().next().value);
}
function hmacValid(raw, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const supplied = String(signature).replace(/^sha256=/i, '');
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}
export function parseSyslog(raw) {
  const value = String(raw || '').trim();
  const match = SYSLOG_PATTERN.exec(value);
  if (!match) throw Object.assign(new Error('MALFORMED_SYSLOG'), { code: 'MALFORMED_SYSLOG' });
  const priority = Number(match.groups.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > 191) throw Object.assign(new Error('SYSLOG_PRIORITY_INVALID'), { code: 'SYSLOG_PRIORITY_INVALID' });
  return { facility: Math.floor(priority / 8), severity_code: priority % 8, severity: SEVERITY[priority % 8], hostname: match.groups.hostname, timestamp: match.groups.timestamp, message: match.groups.message };
}
export function authenticateSyslog(raw, signature, secret = process.env.TSM_ALERTMANAGER_HMAC_SECRET) {
  return hmacValid(String(raw || ''), signature, secret);
}
export function acceptSyslog(raw, signature) {
  const parsed = parseSyslog(raw);
  if (!authenticateSyslog(raw, signature)) throw Object.assign(new Error('ALERT_AUTHENTICATION_FAILED'), { code: 'ALERT_AUTHENTICATION_FAILED', status: 401 });
  prune();
  const eventHash = crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
  if (recentEvents.has(eventHash)) return { duplicate: true, event_id: eventHash, ...parsed };
  recentEvents.set(eventHash, Date.now());
  return { duplicate: false, event_id: eventHash, ...parsed };
}
