# Windows 11 offline / desktop path

**Updated:** 2026-10-15

TSM has **two** Windows desktop planes. Do not conflate them.

## Plane 1 — Tauri 2 console (primary, practical)

Packages the Vite SPA as a native shell (no Unreal required).

| Artifact | How |
|----------|-----|
| NSIS `.exe` | `npm run desktop:build:windows` in `tsm-console` |
| WiX MSI | Same CI/local Windows job |
| Integrity | `SHA256SUMS.txt` from **TSM Desktop** workflow |

### Local (Windows 11)

```powershell
cd tsm-console
npm ci
npm run build
npm run desktop:build:windows
```

### Offline mode

When building for air-gapped use, set:

```text
VITE_TSM_OFFLINE_MODE=1
```

Live USGS/NOAA fetches remain **button-only** even online; offline mode must not invent stage or elevations. Use staged data under offline packages / TSMData manifests only.

Full matrix: [MULTI-INSTALLER-MATRIX.md](MULTI-INSTALLER-MATRIX.md).

## Plane 2 — Unreal Engine 5.8 native (optional)

Requires licensed **UE 5.8**, Visual Studio 2022, and Cesium for Unreal. Linux CI does **not** produce this binary.

1. `tsm-native/TSMNative.uproject`
2. Stage offline data: `scripts/native/stage-native-data-root.mjs`
3. Package → `dist/tsm-native/Windows/`
4. Inno Setup `TSM-Native.iss` → `TSM-Native-Setup-*-windows-x64.exe`

See `tsm-native/README.md` and [unreal-cesium-integration.md](unreal-cesium-integration.md).

**Status:** Scaffold / contract. Not a completed shippable Unreal build until a Windows host completes the steps above.

## What “offline finished” means

| Claim | Valid when |
|-------|------------|
| Tauri Windows installer exists | CI or local `desktop:build:windows` artifact + checksum |
| Unreal offline operator app | Packaged UE build + TSMData manifest verified + Inno installer |
| No network authority | Runtime refuses silent network fallback for regulatory numbers |

Pages SPA alone does **not** equal offline desktop complete.
