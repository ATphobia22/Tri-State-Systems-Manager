# TSM Multi-Installer / Cross-Platform Matrix

Community-scale engineering console packaged for every workstation the Tri-State River Valley uses.

## Desktop console (Tauri 2) — primary multi-installer path

| Platform | Architectures | Installer artifacts | CI job |
|---|---|---|---|
| **Windows** | x64 | NSIS `.exe`, WiX **MSI** | `tsm-desktop.yml` → `windows` |
| **macOS** | universal (release) / host (CI) | **DMG** | `tsm-desktop.yml` → `macos` |
| **Linux** | x86_64 | **AppImage**, **deb** | `tsm-desktop.yml` → `linux` |

### Local builds

```bash
cd tsm-console
npm ci
npm run build

# Windows (on Windows host or CI)
npm run desktop:build:windows

# macOS
npm run desktop:build:macos

# Linux
npm run desktop:build:linux
```

### CI triggers

- Push / PR to `main` (paths under `tsm-console/**`)
- Manual `workflow_dispatch` on **TSM Desktop**
- Tagged release via **TSM Desktop Release** (`workflow_dispatch` with tag)

### Integrity

Each desktop CI run uploads platform artifacts and a combined `SHA256SUMS.txt` integrity artifact.

## Native Unreal / Archimedes plane (optional high-fidelity)

Separate from the Tauri console. See `tsm-native/` and `scripts/native/`.

| Platform | Packaging | Notes |
|---|---|---|
| Windows | Inno Setup `TSM-Native.iss` → `TSM-Native-Setup-*-windows-x64.exe` | Requires packaged Unreal build under `dist/tsm-native/Windows/` |
| macOS / iOS / iPadOS / Android / Linux | Declared in `tsm-native/config/platform-build-matrix.json` | Build each architecture explicitly; no silent cross-compile |

Sovereign runtime rules (native matrix): no embedded browser/Node as authority; numerical core stays platform-neutral C++.

## File associations (desktop)

- `.tsmproj` — TSM project (owner/editor)
- `.pmtiles` — PMTiles archive (viewer)

## Signing / notarization (production)

| Platform | Secrets / steps |
|---|---|
| Windows | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` |
| macOS | `APPLE_SIGNING_IDENTITY`, notarization credentials for release |
| Linux | AppImage/deb unsigned in CI by default; distribute with SHA256SUMS |

Ad-hoc macOS signing (`APPLE_SIGNING_IDENTITY=-`) is acceptable for CI smoke; production releases should use Developer ID + notarization.

## Version alignment

- Console package / Tauri product version: see `tsm-console/package.json` and `src-tauri/tauri.conf.json`
- Keep both versions synchronized before a desktop release tag (`desktop-vX.Y.Z`)
