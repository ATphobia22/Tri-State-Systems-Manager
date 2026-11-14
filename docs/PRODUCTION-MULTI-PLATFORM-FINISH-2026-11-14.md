# Production-Grade Multi-Platform Finish — TSM (2026-11-14)

## Definition of done (engineering)

| Layer | Windows 11 | macOS | Linux | iOS |
|-------|------------|-------|-------|-----|
| Web SPA (Pages) | ✅ | ✅ | ✅ | ✅ (Capacitor shell) |
| Tauri desktop bundles | NSIS + MSI | DMG | AppImage + deb | — |
| Offline runtime | Scripts + CI | matrix | matrix | resilient gauges |
| CI workflow | `offline-runtime-windows`, desktop | macos jobs | linux jobs | `ios-build.yml` |
| Signing path | cert secrets | Developer ID + notarize | SHA256SUMS | Apple Distribution + profiles |
| Version pin | package.json 0.2.1 | same | same | MARKETING_VERSION in Xcode |

## Commands (host required)

```bash
cd tsm-console && npm ci && npm run build

# Desktop
npm run desktop:build:windows   # Win11 host or windows-latest CI
npm run desktop:build:macos     # macOS host
npm run desktop:build:linux     # Linux host

# iOS (macOS + Xcode only)
npx cap sync ios
# then archive per docs/BUILD-IOS.md
```

## Production release sequence

1. Bump `tsm-console/package.json` version; align Tauri conf; iOS MARKETING_VERSION.  
2. Tag `desktop-vX.Y.Z` / `ios-vX.Y.Z`.  
3. Run **TSM Desktop** workflow + **ios-build** with secrets populated.  
4. Attach SHA256SUMS; publish artifacts; notarize Mac; upload iOS to TestFlight if keys present.  
5. GitHub Pages SPA remains continuous deploy on main.

## Secrets required for signed production binaries

| Platform | Secrets |
|----------|---------|
| Windows | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` |
| macOS | `APPLE_SIGNING_IDENTITY`, notarization credentials |
| iOS | `APPLE_DISTRIBUTION_CERT_P12`, profile, Team ID, ASC API key |

Without secrets, CI still builds **unsigned** / ad-hoc smoke artifacts where the workflow allows.

## Explicit boundary

This repository **completes** the production-grade **software surface**: installers, CI, offline paths, Capacitor iOS project, resilient hydrology, evidence gates, multi-installer matrix.

It does **not** claim:
- App Store / Play Store listing live without your account actions  
- UE5.8 Shipping binary without a Windows Unreal runner  
- Signed store binaries in this Linux environment (impossible without Apple/Microsoft certs)

## Related

- `docs/MULTI-INSTALLER-MATRIX.md`  
- `docs/PLATFORM-FINISH-MATRIX-2026-11-14.md`  
- `docs/BUILD-IOS.md`  
- `docs/WINDOWS-11-OFFLINE-DESKTOP.md`  
- `.github/workflows/ios-build.yml`  
- `packages/hydrology` resilient stage (full jitter + circuit breaker)  
