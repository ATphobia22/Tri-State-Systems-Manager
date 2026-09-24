#!/usr/bin/env bash
set -euo pipefail
CLASS="${1:?usage: validate-native-runner.sh <runner-class>}"
case "$CLASS" in
  linux-native) command -v cmake >/dev/null; command -v ninja >/dev/null; command -v clang >/dev/null; command -v clang-tidy >/dev/null ;;
  macos-ue5) test -n "${UE_ROOT:-}"; test -x "${UE_ROOT:-}/Engine/Build/BatchFiles/RunUAT.sh"; xcodebuild -version >/dev/null; codesign --version >/dev/null; xcrun notarytool --help >/dev/null; command -v cmake >/dev/null; command -v ninja >/dev/null ;;
  ios-ue5) test -n "${UE_ROOT:-}"; test -x "${UE_ROOT:-}/Engine/Build/BatchFiles/RunUAT.sh"; xcodebuild -version >/dev/null; codesign --version >/dev/null ;;
  android-ue5) test -n "${UE_ROOT:-}"; test -x "${UE_ROOT:-}/Engine/Build/BatchFiles/RunUAT.sh"; test -n "${ANDROID_HOME:-}"; test -n "${ANDROID_NDK_ROOT:-}"; command -v cmake >/dev/null; command -v ninja >/dev/null ;;
  *) echo "Unknown runner class: $CLASS" >&2; exit 2 ;;
esac
echo "Runner contract OK: $CLASS"
