#!/usr/bin/env bash
# The v1.0.0 upstream installer explicitly chmods bin/roofer after extraction.
# Retain its bundled data and libraries rather than using the PDAL environment.
set -euo pipefail
prefix="${TSM_ROOFER_PREFIX:?TSM_ROOFER_PREFIX required}"
test -f "$prefix/bin/roofer" || { echo "Missing release bin/roofer" >&2; exit 2; }
test -x "$prefix/bin/roofer" || { echo "Release bin/roofer is not executable" >&2; exit 2; }
if [[ -d "$prefix/share/proj" ]]; then
    export PROJ_DATA="$prefix/share/proj"
    export PROJ_LIB="$PROJ_DATA"
else
    unset PROJ_DATA PROJ_LIB
fi
if [[ -d "$prefix/share/gdal" ]]; then
    export GDAL_DATA="$prefix/share/gdal"
else
    unset GDAL_DATA
fi
unset GDAL_DRIVER_PATH
export PROJ_NETWORK=OFF
if [[ -d "$prefix/lib" ]]; then
    export LD_LIBRARY_PATH="$prefix/lib"
else
    unset LD_LIBRARY_PATH
fi
exec "$prefix/bin/roofer" "$@"
