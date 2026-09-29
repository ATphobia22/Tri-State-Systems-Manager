# Plus Codes (Open Location Code) — C implementation

Vendored from: https://github.com/google/open-location-code (`c/src/olc.c`,
`c/src/olc.h`, `c/src/olc_private.h`)

License: Apache License 2.0 (same as this project). The upstream C files carry
no per-file header; they are covered by the upstream repository's Apache-2.0
LICENSE.

## Why it is here

Plus Codes give field crews a short, offline-safe location handle (~10-11
characters) for evidence photos and sensor readings where street addresses do
not exist. This is the native (Unreal 5.8) counterpart to the JavaScript
vendoring in `tsm-console/src/lib/vendor/openlocationcode.js`; both compute
identically with zero network access, satisfying the air-gapped deployment
target.

## Integration notes

- `olc.c` is dependency-free C99: add it to the TSMGIS module's build sources
  and include `olc.h` from native code. No third-party build system changes.
- API surface: `olc_encode(lat, lng, length, buf, buflen)`,
  `olc_decode(code, &area)`, `olc_is_valid(code)`, `olc_is_full(code)`,
  `olc_shorten(...)`, `olc_recover_nearest(...)`.
- Do not modify these files in place; re-vendor from upstream instead.
