#!/usr/bin/env bash
set -euo pipefail
BINARY_PATH="${1:?usage: Verify-NativeArtifactDependencies.sh <binary> [expected-sha256]}"
EXPECTED_SHA256="${2:-}"
if [[ ! -f "${BINARY_PATH}" ]]; then echo "Native artifact does not exist: ${BINARY_PATH}" >&2; exit 1; fi
HASH="$(shasum -a 256 "${BINARY_PATH}" | awk '{print tolower($1)}')"
if [[ -n "${EXPECTED_SHA256}" && "${HASH}" != "${EXPECTED_SHA256,,}" ]]; then echo "SHA-256 mismatch for ${BINARY_PATH}: expected ${EXPECTED_SHA256}, got ${HASH}" >&2; exit 1; fi
if [[ "$(uname -s)" == "Darwin" ]]; then codesign --verify --deep --strict "${BINARY_PATH}"; fi
echo "Native artifact verified: ${BINARY_PATH}"
echo "SHA-256: ${HASH}"
