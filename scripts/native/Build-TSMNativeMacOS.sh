#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${UE_ROOT:?UE_ROOT must point to the Unreal Engine 5.8 installation}"
: "${TSM_SPATIALITE_DYLIB:?TSM_SPATIALITE_DYLIB must point to the packaged mod_spatialite.dylib}"
cmake -S "$ROOT_DIR/native/archimedes" -B "$ROOT_DIR/native/archimedes/build-macos" -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build "$ROOT_DIR/native/archimedes/build-macos" --parallel
ctest --test-dir "$ROOT_DIR/native/archimedes/build-macos" --output-on-failure
mkdir -p "$ROOT_DIR/tsm-native/Binaries"
cp "$(find "$ROOT_DIR/native/archimedes/build-macos" -type f -name 'libArchimedesCore.dylib' -print -quit)" "$ROOT_DIR/tsm-native/Binaries/libArchimedesCore.dylib"
"$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$ROOT_DIR/tsm-native/TSMNative.uproject" -noP4 -build -cook -stage -pak -package -archive -archivedirectory="$ROOT_DIR/dist/tsm-native" -platform=Mac -clientconfig=Shipping -utf8output
