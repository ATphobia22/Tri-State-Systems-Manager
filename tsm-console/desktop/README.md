# TSM Desktop — offline app (Windows 11 portable, Linux AppImage)

Standalone, installation-free desktop application for the Tri-State Systems
Manager console. Double-click the portable `.exe` on Windows 11 (or run it
from a USB drive); run the `.AppImage` on Linux — no login, no network, no
installer.

## What it contains

- The full TSM console SPA (Vite production build), served from the app over
  loopback HTTP with the API base injected at runtime.
- The TSM Node API (`tsm-console/server`), spawned as a local child process
  bound to **127.0.0.1 only** with `TSM_AUTH_MODE=disabled`,
  `TSM_LOCAL_MODE=1`, `TSM_OFFLINE=1`. Single-user local operator; mutations
  are allowed locally and refused anywhere else (see `server/auth/oidc-auth.mjs`).
- The repository `data/` bundle (Posey County offline datasets, flood
  fabrics, schemas, scenarios) as unpacked resources.
- Evidence writes go to the per-user app-data directory, never into the
  application bundle.

## Networking posture

- The renderer is hardened: context isolation, no Node integration, sandbox,
  no external navigation, and a `webRequest` filter that permits only loopback
  `http(s)` plus `data:`/`blob:` **for renderer traffic**.
- The API child binds 127.0.0.1 only; the live river-data routes return an
  explicit `OFFLINE_MODE` error instead of attempting upstream requests.
- Honest limit: the renderer filter does not constrain the API child process
  itself. Treat the app as *loopback-only*, not as a formally verified
  air-gap, until every upstream-fetching server route is audited.

## Build

```bash
# 1. Install desktop deps (first time)
npm install --prefix tsm-console/desktop

# 2a. Windows 11 portable exe (built on Linux, no Wine needed)
npm run dist:win --prefix tsm-console/desktop
# → tsm-console/desktop/release/TSM-Console-0.2.1-win11-portable.exe

# 2b. Linux AppImage
npm run dist:linux --prefix tsm-console/desktop
# → tsm-console/desktop/release/Tri-State Systems Manager-0.2.1.AppImage

# 2c. macOS DMG (requires a Mac for build/signing/notarization)
npm run dist:mac --prefix tsm-console/desktop
```

Both `dist:win` and `dist:linux` rebuild the SPA and stage it automatically
via `prebuild:stage`. `release/` holds build output plus a `.sha256` file per
artifact; it is not committed.

### Windows exe stamping without Wine

electron-builder normally shells out to `rcedit` under Wine to embed the
icon and version metadata. This repo disables that
(`win.signAndEditExecutable: false`) and instead stamps the exe with the
pure-JavaScript [`resedit`](https://www.npmjs.com/package/resedit) library:

- `scripts/stamp-win-exe.mjs` — reusable stamper (icon group + `VS_VERSIONINFO`).
- Wired as an electron-builder `afterPack` hook, so the inner Electron exe is
  stamped before the portable wrapper is assembled; the script is also run
  once more over the final portable exe as a CLI step.

## Dev run (no packaging)

```bash
npm run build --prefix tsm-console
npm start --prefix tsm-console/desktop
```

## Notes

- Version is kept in sync with `tsm-console/package.json` manually.
- macOS icon (`assets/icon.icns`, 16–512 px) is checked in; signing and
  notarization still need a Mac.
- `release/`, `stage/`, and `node_modules/` are build output and are not committed.
