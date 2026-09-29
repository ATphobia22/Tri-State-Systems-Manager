#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${UE_ROOT:?UE_ROOT must point to the Unreal Engine 5.8 installation}"
: "${TSM_SPATIALITE_SO:?TSM_SPATIALITE_SO must point to the packaged mod_spatialite.so}"
cmake -S "$ROOT_DIR/native/archimedes" -B "$ROOT_DIR/native/archimedes/build-linux" -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build "$ROOT_DIR/native/archimedes/build-linux" --parallel
ctest --test-dir "$ROOT_DIR/native/archimedes/build-linux" --output-on-failure
mkdir -p "$ROOT_DIR/tsm-native/Binaries"
cp "$(find "$ROOT_DIR/native/archimedes/build-linux" -type f -name 'libArchimedesCore.so' -print -quit)" "$ROOT_DIR/tsm-native/Binaries/libArchimedesCore.so"
"$UE_ROOT/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$ROOT_DIR/tsm-native/TSMNative.uproject" -noP4 -build -cook -stage -pak -package -archive -archivedirectory="$ROOT_DIR/dist/tsm-native" -platform=Linux -clientconfig=Shipping -utf8output
