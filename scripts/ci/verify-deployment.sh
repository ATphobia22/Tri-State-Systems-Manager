#!/usr/bin/env bash
# Verify a built frontend artifact and optionally probe a live deployment.
# This gate is read-only and never prints secret values.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONSOLE_DIR="${ROOT_DIR}/tsm-console"
ARTIFACT_DIR="${CONSOLE_DIR}/dist"
BASE_URL="${TSM_DEPLOYMENT_BASE_URL:-}"
EXPECTED_SHA="${TSM_EXPECTED_BUILD_SHA:-${GITHUB_SHA:-}}"
TIMEOUT_SECONDS="${TSM_VERIFY_TIMEOUT_SECONDS:-15}"
REQUIRE_LIVE="${TSM_REQUIRE_LIVE_DEPLOYMENT:-false}"

fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$1"; }
warn() { printf 'WARN: %s\n' "$1" >&2; }

command -v node >/dev/null 2>&1 || fail 'Node.js is required.'
command -v curl >/dev/null 2>&1 || fail 'curl is required.'
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "${NODE_MAJOR}" =~ ^[0-9]+$ ]] || fail 'Unable to determine Node.js major version.'
(( NODE_MAJOR >= 22 )) || fail "Node.js 22+ is required; found $(node --version)."
[[ -s "${CONSOLE_DIR}/package-lock.json" ]] || fail 'tsm-console/package-lock.json is missing.'
[[ -s "${ARTIFACT_DIR}/index.html" ]] || fail "Production artifact is missing: ${ARTIFACT_DIR}/index.html"

if find "${ARTIFACT_DIR}" -type f \( -name '*.map' -o -name '*.pem' -o -name '*.key' -o -name '*.env' \) -print -quit | grep -q .; then
  fail 'Potentially sensitive files were found in the production artifact.'
fi
if grep -RIlE --exclude='*.map' '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{20,})' "${ARTIFACT_DIR}" >/dev/null 2>&1; then
  fail 'Potential secret material was detected in the production artifact.'
fi
pass 'Production frontend artifact exists and contains no obvious secret material.'

if [[ -z "${BASE_URL}" ]]; then
  [[ "${REQUIRE_LIVE}" != 'true' ]] || fail 'TSM_DEPLOYMENT_BASE_URL is required when TSM_REQUIRE_LIVE_DEPLOYMENT=true.'
  warn 'No TSM_DEPLOYMENT_BASE_URL supplied; live deployment checks skipped.'
  printf '%s\n' 'Deployment verification completed in artifact-only mode.'
  exit 0
fi

if [[ ! "${BASE_URL}" =~ ^https:// && "${BASE_URL}" != http://localhost:* && "${BASE_URL}" != http://127.0.0.1:* ]]; then
  fail 'TSM_DEPLOYMENT_BASE_URL must use HTTPS except for localhost/127.0.0.1 verification.'
fi
BASE_URL="${BASE_URL%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

fetch() {
  local path="$1" output="$2"
  curl --fail --silent --show-error --location \
    --connect-timeout "${TIMEOUT_SECONDS}" --max-time "${TIMEOUT_SECONDS}" \
    --retry 2 --retry-delay 1 --retry-all-errors \
    -D "${output}.headers" -o "${output}" "${BASE_URL}${path}"
}

check_json_field() {
  local file="$1" expression="$2"
  node --input-type=module - "${file}" "${expression}" <<'NODE'
import fs from 'node:fs';
const [file, expression] = process.argv.slice(2);
const body = JSON.parse(fs.readFileSync(file, 'utf8'));
let value = body;
for (const part of expression.split('.')) value = value?.[part];
if (expression === 'ok' || expression === 'ready') {
  if (value !== true) process.exit(1);
} else if (value === undefined || value === null || value === false || value === '') {
  process.exit(1);
}
NODE
}

READY_FILE="${TMP_DIR}/ready.json"
fetch '/ready' "${READY_FILE}"
check_json_field "${READY_FILE}" 'ok' || fail '/ready did not report boolean ok=true.'
check_json_field "${READY_FILE}" 'ready' || fail '/ready did not report boolean ready=true.'
check_json_field "${READY_FILE}" 'build_sha' || fail '/ready did not expose build_sha.'
DEPLOYED_SHA="$(node --input-type=module - "${READY_FILE}" <<'NODE'
import fs from 'node:fs';
const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(String(body.build_sha ?? ''));
NODE
)"
if [[ -n "${EXPECTED_SHA}" && "${EXPECTED_SHA}" != 'local' && "${DEPLOYED_SHA}" != "${EXPECTED_SHA}" ]]; then
  fail "Live build SHA mismatch: expected ${EXPECTED_SHA}, received ${DEPLOYED_SHA}."
fi
pass "Live /ready contract passed (build_sha=${DEPLOYED_SHA})."

HEALTH_FILE="${TMP_DIR}/health.json"
fetch '/health' "${HEALTH_FILE}"
check_json_field "${HEALTH_FILE}" 'ok' || fail '/health did not report boolean ok=true.'
check_json_field "${HEALTH_FILE}" 'service' || fail '/health did not expose service identity.'
pass 'Live /health contract passed.'

SOURCES_FILE="${TMP_DIR}/sources.json"
fetch '/api/data-sources/health' "${SOURCES_FILE}"
check_json_field "${SOURCES_FILE}" 'sources' || fail '/api/data-sources/health did not expose sources.'
pass 'Live data-source health endpoint responded successfully.'

SITE_FILE="${TMP_DIR}/site.json"
fetch '/api/geospatial/posey/site' "${SITE_FILE}"
check_json_field "${SITE_FILE}" 'ok' || fail '/api/geospatial/posey/site did not report boolean ok=true.'
check_json_field "${SITE_FILE}" 'horizontal_crs' || fail 'Posey geospatial endpoint did not expose horizontal_crs.'
pass 'Live geospatial site contract passed.'

grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' "${READY_FILE}.headers" || fail 'Missing X-Content-Type-Options: nosniff.'
grep -Eiq '^x-frame-options:[[:space:]]*deny' "${READY_FILE}.headers" || fail 'Missing X-Frame-Options: DENY.'
grep -Eiq '^cache-control:[[:space:]]*no-store' "${READY_FILE}.headers" || fail 'Missing Cache-Control: no-store on readiness response.'
pass 'Required API security headers are present.'

CORS_HEADERS="${TMP_DIR}/cors.headers"
CURL_STATUS="$(curl --silent --show-error --location \
  --connect-timeout "${TIMEOUT_SECONDS}" --max-time "${TIMEOUT_SECONDS}" \
  -o /dev/null -D "${CORS_HEADERS}" -w '%{http_code}' \
  -X OPTIONS "${BASE_URL}/ready" \
  -H 'Origin: https://untrusted.invalid' \
  -H 'Access-Control-Request-Method: GET')"
if grep -Eiq '^access-control-allow-origin:[[:space:]]*\*' "${CORS_HEADERS}"; then fail 'Wildcard CORS was detected.'; fi
if grep -Eiq '^access-control-allow-origin:[[:space:]]*https://untrusted\.invalid[[:space:]]*$' "${CORS_HEADERS}"; then fail 'Foreign CORS origin was reflected by the deployment.'; fi
[[ "${CURL_STATUS}" == '204' ]] || fail "Unexpected CORS preflight status: ${CURL_STATUS}"
pass 'CORS smoke check rejected the foreign origin.'
printf '%s\n' '--------------------------------------------------------------------'
printf 'DEPLOYMENT VERIFICATION PASSED: %s\n' "${BASE_URL}"
