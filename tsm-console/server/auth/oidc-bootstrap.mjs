import { setTimeout as sleep } from 'node:timers/promises';

const KEYCLOAK_URL = String(process.env.OIDC_ISSUER || '').replace(/\/realms\/tsm\/?$/, '');
const REALM = 'tsm';
const CLIENT_ID = String(process.env.OIDC_CLIENT_ID || 'tsm-console-bff');
const CLIENT_SECRET = String(process.env.OIDC_CLIENT_SECRET || '');
const AUDIENCE = String(process.env.OIDC_AUDIENCE || 'tsm-console-api');
const REDIRECT_URI = String(process.env.OIDC_REDIRECT_URI || '');
const WEB_ORIGIN = 'https://atphobia22.github.io';
const ADMIN_USER = String(process.env.KEYCLOAK_ADMIN_USERNAME || '');
const ADMIN_PASSWORD = String(process.env.KEYCLOAK_ADMIN_PASSWORD || '');

async function request(path, options = {}) {
  return fetch(KEYCLOAK_URL + path, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
}
async function waitForMasterDiscovery() {
  if (!KEYCLOAK_URL) throw new Error('OIDC_ISSUER is required for Keycloak bootstrap.');
  for (let attempt = 1; attempt <= 90; attempt += 1) {
    try { if ((await request('/realms/master/.well-known/openid-configuration')).ok) return; } catch {}
    await sleep(2000);
  }
  throw new Error('Keycloak master OIDC discovery did not become available.');
}
async function adminToken() {
  if (!ADMIN_USER || !ADMIN_PASSWORD) throw new Error('KEYCLOAK_ADMIN_USERNAME and KEYCLOAK_ADMIN_PASSWORD are required for OIDC bootstrap.');
  const body = new URLSearchParams({ client_id: 'admin-cli', username: ADMIN_USER, password: ADMIN_PASSWORD, grant_type: 'password' });
  const response = await request('/realms/master/protocol/openid-connect/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new Error('Keycloak admin authentication failed.');
  const document = await response.json();
  if (typeof document.access_token !== 'string') throw new Error('Keycloak admin token was not returned.');
  return document.access_token;
}
async function ensureRealm(token) {
  const existing = await request('/admin/realms/' + REALM, { headers: { Authorization: 'Bearer ' + token } });
  if (existing.ok) return;
  if (existing.status !== 404) throw new Error('Keycloak realm lookup failed with HTTP ' + existing.status + '.');
  const response = await request('/admin/realms', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ realm: REALM, displayName: 'Tri-State Systems Manager', enabled: true }) });
  if (!response.ok && response.status !== 409) throw new Error('Keycloak realm creation failed with HTTP ' + response.status + '.');
}
async function ensureClient(token) {
  const query = await request('/admin/realms/' + REALM + '/clients?clientId=' + encodeURIComponent(CLIENT_ID), { headers: { Authorization: 'Bearer ' + token } });
  if (!query.ok) throw new Error('Keycloak client lookup failed with HTTP ' + query.status + '.');
  const clients = await query.json();
  let client = Array.isArray(clients) ? clients[0] : null;
  if (!client?.id) {
    const create = await request('/admin/realms/' + REALM + '/clients', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: CLIENT_ID, enabled: true, publicClient: false, protocol: 'openid-connect' }) });
    if (!create.ok) throw new Error('Keycloak client creation failed with HTTP ' + create.status + '.');
    const location = create.headers.get('location');
    const id = location?.split('/').pop();
    if (!id) throw new Error('Keycloak client creation returned no client id.');
    client = { id };
  }
  if (!CLIENT_SECRET || CLIENT_SECRET.length < 16) throw new Error('OIDC_CLIENT_SECRET must be at least 16 characters.');
  const update = await request('/admin/realms/' + REALM + '/clients/' + client.id, {
    method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: client.id, clientId: CLIENT_ID, enabled: true, clientAuthenticatorType: 'client-secret', secret: CLIENT_SECRET, publicClient: false, protocol: 'openid-connect', standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false, authorizationServicesEnabled: false, redirectUris: [REDIRECT_URI], webOrigins: [WEB_ORIGIN], attributes: { 'pkce.code.challenge.method': 'S256', 'require.pkce': 'true' } })
  });
  if (!update.ok) throw new Error('Keycloak client configuration failed with HTTP ' + update.status + '.');
  return client.id;
}
async function ensureRole(token, clientId, role) {
  const encoded = encodeURIComponent(role);
  const base = '/admin/realms/' + REALM + '/clients/' + clientId + '/roles';
  const existing = await request(base + '/' + encoded, { headers: { Authorization: 'Bearer ' + token } });
  if (existing.ok) return;
  if (existing.status !== 404) throw new Error('Keycloak client-role lookup failed for ' + role + ' with HTTP ' + existing.status + '.');
  const response = await request(base, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: role }) });
  if (!response.ok && response.status !== 409) throw new Error('Keycloak client-role bootstrap failed for ' + role + ' with HTTP ' + response.status + '.');
}
async function ensureAudienceMapper(token, clientId) {
  const list = await request('/admin/realms/' + REALM + '/clients/' + clientId + '/protocol-mappers/models', { headers: { Authorization: 'Bearer ' + token } });
  if (!list.ok) throw new Error('Keycloak protocol mapper lookup failed with HTTP ' + list.status + '.');
  const mappers = await list.json();
  if (Array.isArray(mappers) && mappers.some((mapper) => mapper.name === 'tsm-audience')) return;
  const response = await request('/admin/realms/' + REALM + '/clients/' + clientId + '/protocol-mappers/models', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'tsm-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper', consentRequired: false, config: { 'included.client.audience': AUDIENCE, 'access.token.claim': 'true', 'id.token.claim': 'false' } }) });
  if (!response.ok && response.status !== 409) throw new Error('Keycloak audience mapper bootstrap failed with HTTP ' + response.status + '.');
}
export async function bootstrapOidc() {
  if (String(process.env.TSM_AUTH_MODE || 'required').toLowerCase() === 'disabled') return;
  await waitForMasterDiscovery();
  const token = await adminToken();
  await ensureRealm(token);
  const clientId = await ensureClient(token);
  await ensureRole(token, clientId, 'tsm-operator');
  await ensureRole(token, clientId, 'tsm-reviewer');
  await ensureAudienceMapper(token, clientId);
  const discovery = await request('/realms/' + REALM + '/.well-known/openid-configuration');
  if (!discovery.ok) throw new Error('TSM OIDC discovery failed with HTTP ' + discovery.status + '.');
  const document = await discovery.json();
  const issuer = String(process.env.OIDC_ISSUER || '').replace(/\/$/, '');
  if (document.issuer !== issuer) throw new Error('TSM OIDC issuer verification failed.');
}
