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

Gaia-SINS publishes the Windows amd64 `mod_spatialite-5.1.0-win-amd64.7z` package. The archive was identified from the official Gaia-SINS Windows amd64 directory. Verify the downloaded archive and extracted DLL hashes locally before promotion.

Source: https://www.gaia-gis.it/gaia-sins/windows-bin-amd64/

## TSM policy

Do not copy unverified DLLs into `tsm-native/Binaries/Win64`. The Windows packaging script should consume a prepared dependency root and the final artifact verification must hash every shipped DLL.
