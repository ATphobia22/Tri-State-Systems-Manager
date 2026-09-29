# Windows Native Dependencies

These dependencies are **not silently vendored** into the TSM source tree. Acquire them on the Windows build host, verify the published hash where available, and record the resulting binary hashes in the immutable data/artifact manifest.

## SQLite

Official SQLite Windows x64 DLL and tools packages are published by sqlite.org. Current release identified during verification: 3.53.4.

- DLL: `sqlite-dll-win-x64-3530400.zip`
- Tools: `sqlite-tools-win-x64-3530400.zip`
- DLL SHA3-256: `deddee963c810d1eeac3ce5e15c7c41da21a1c54d7a39cf54fbf577d2f50de3a`
- Tools SHA3-256: `88b4659fe747896b853af10157316b4ade143553efb89c1c8ca7423a278dcc8b`

Source: https://www.sqlite.org/download.html

## SpatiaLite

Gaia-SINS publishes the Windows amd64 packages. Verified locally 2026-09-29
against operator-supplied archives (hashes now recorded in
`dependency-lock.json`):

- `mod_spatialite-5.1.0-win-amd64.7z` — SHA3-256
  `58e4e49de3c2c3b32a6b66542e5ab8879db997d0d86dac38bbbb49db29516e0e`;
  contents match the official layout (mod_spatialite.dll + 27 dependency
  DLLs: GEOS, PROJ 9.2, libsqlite3, etc.)
- `spatialite-tools-5.1.0a-win-amd64.7z` — SHA3-256
  `71ac58f52e98697e4859eeb1665ae0179f0e1c9cb1ed4fa5392ab346e9565af9`;
  21 tools including spatialite.exe plus proj.db

The sqlite-tools archive also matched its official published SHA3-256
exactly (`88b4659f…dcc8b`).

Source: https://www.gaia-gis.it/gaia-sins/windows-bin-amd64/

## Distribution

The 7z/zip archives exceed GitHub's per-file limits and are **not committed
to git**. They ship in the Windows installation package
(`tools/sqlite/`, `tools/spatialite/`) and on the USB deployment archive.

## TSM policy

Do not copy unverified DLLs into `tsm-native/Binaries/Win64`. The Windows packaging script should consume a prepared dependency root and the final artifact verification must hash every shipped DLL.
