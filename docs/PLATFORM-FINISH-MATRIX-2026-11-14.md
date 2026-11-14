# Platform Finish Matrix — TSM Console + Native (2026-11-14)

## Desktop (Tauri 2) — primary

| Platform | Artifact | Status | Command / CI |
|----------|----------|--------|----------------|
| **Windows 11** x64 | NSIS + MSI | Matrix defined; offline path documented | `npm run desktop:build:windows` · `docs/WINDOWS-11-OFFLINE-DESKTOP.md` |
| **macOS** | DMG | Matrix defined | `npm run desktop:build:macos` |
| **Linux** | AppImage + deb | Matrix defined | `npm run desktop:build:linux` |

CI: `.github/workflows` TSM Desktop — SHA256SUMS per run.

## Mobile / other

| Platform | Path | Notes |
|----------|------|-------|
| **iOS / iPadOS** | `docs/BUILD-IOS.md` + native matrix | Requires Xcode host; no silent cross-compile from Linux CI |
| **Android** | Native matrix declaration | Explicit arch build |
| **Native Unreal Windows** | Inno Setup | Separate plane from Tauri |

## Finish checklist (release tag `desktop-vX.Y.Z`)
1. Sync `tsm-console/package.json` ↔ `src-tauri/tauri.conf.json` version  
2. Windows: signed NSIS/MSI when certs present  
3. macOS: Developer ID + notarization for production (ad-hoc OK for smoke)  
4. Linux: AppImage + deb + SHA256SUMS  
5. iOS: archive on macOS runner / local; TestFlight optional  
6. Offline Windows 11 scripts under `scripts/windows/` verified  

## Non-claims
CI does not produce App Store / Play Store binaries without store credentials. Native UE5.8 Shipping remains a separate evidence gate.
