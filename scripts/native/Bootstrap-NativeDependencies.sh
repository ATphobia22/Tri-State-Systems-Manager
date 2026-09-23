#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST_ROOT="${ROOT_DIR}/native/dependencies"
VCPKG_ROOT="${VCPKG_ROOT:-${ROOT_DIR}/.native-tools/vcpkg}"
TRIPLET="${1:-}"
LOCKED_VCPKG_COMMIT="5f96cd15fd745122cf27e0524606d6c1efc5fd07"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 1
fi

if [[ -z "${TRIPLET}" ]]; then
  case "$(uname -s):$(uname -m)" in
    Darwin:arm64) TRIPLET="arm64-osx" ;;
    Darwin:x86_64) TRIPLET="x64-osx" ;;
    Linux:aarch64|Linux:arm64) TRIPLET="arm64-linux" ;;
    Linux:x86_64) TRIPLET="x64-linux" ;;
    *) echo "Unable to infer vcpkg triplet; pass one explicitly." >&2; exit 2 ;;
  esac
fi

if [[ ! -d "${VCPKG_ROOT}/.git" ]]; then
  mkdir -p "$(dirname "${VCPKG_ROOT}")"
  git clone --filter=blob:none https://github.com/microsoft/vcpkg.git "${VCPKG_ROOT}"
fi

git -C "${VCPKG_ROOT}" fetch --quiet origin "${LOCKED_VCPKG_COMMIT}"
git -C "${VCPKG_ROOT}" checkout --quiet --detach "${LOCKED_VCPKG_COMMIT}"

case "$(uname -s)" in
  Darwin)
    if command -v brew >/dev/null 2>&1; then brew install autoconf autoconf-archive automake libtool; fi
    ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y autoconf autoconf-archive automake libtool; fi
    ;;
esac

if [[ ! -x "${VCPKG_ROOT}/vcpkg" ]]; then
  "${VCPKG_ROOT}/bootstrap-vcpkg.sh" -disableMetrics
fi

"${VCPKG_ROOT}/vcpkg" install \
  --x-manifest-root="${MANIFEST_ROOT}" \
  --triplet="${TRIPLET}"

echo "TSM native dependencies installed."
echo "vcpkg root: ${VCPKG_ROOT}"
echo "triplet: ${TRIPLET}"
echo "manifest: ${MANIFEST_ROOT}"
