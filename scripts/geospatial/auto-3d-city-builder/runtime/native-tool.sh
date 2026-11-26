#!/usr/bin/env bash
# Use exclusively the matching native package database; do not change Python's
# pyproj/rasterio data paths or allow remote PROJ grid downloads.
set -euo pipefail
prefix="${TSM_PDAL_PREFIX:?TSM_PDAL_PREFIX is required}"
name="$(basename "$0")"
case "$name" in
  pdal|ogr2ogr|projinfo) ;;
  *) echo "Unsupported native executable: $name" >&2; exit 2;;
esac
test -f "$prefix/share/proj/proj.db" || { echo "Missing native PROJ database" >&2; exit 2; }
test -d "$prefix/share/gdal" || { echo "Missing native GDAL data" >&2; exit 2; }
test -x "$prefix/bin/$name" || { echo "Missing native executable: $name" >&2; exit 2; }
export PROJ_DATA="$prefix/share/proj"
export PROJ_LIB="$PROJ_DATA"
export GDAL_DATA="$prefix/share/gdal"
export PROJ_NETWORK=OFF
export LD_LIBRARY_PATH="$prefix/lib"
# Avoid inheriting a plugin directory from a different GDAL installation.
unset GDAL_DRIVER_PATH
exec "$prefix/bin/$name" "$@"
