# TSM Windows + macOS Desktop

TSM Desktop wraps the existing React/Vite console with Tauri 2. The frontend remains the authoritative UI implementation; native functionality is deliberately limited to the desktop shell and signed update mechanism.

## Distribution

Windows x64 produces NSIS EXE and WiX MSI installers. macOS produces DMG and App Bundle artifacts. Windows MSI builds run on Windows because WiX is Windows-only. macOS signing and notarization run only on Apple-hosted runners.

## Security

- No updater key is committed to source control.
- Release CI must provide TSM_UPDATER_PUBLIC_KEY and TAURI_SIGNING_PRIVATE_KEY through GitHub Actions secrets.
- Update endpoints are HTTPS-only.
- Tauri updater signatures are mandatory.
- Windows release artifacts must be Authenticode signed before external distribution.
- macOS direct distribution must use Developer ID signing, Hardened Runtime, notarization, and stapling.
- Secrets are never written to Git-tracked files.

## Data boundary

The desktop bundle does not contain a writable production PostgreSQL/PostGIS data directory. Local services and caches use explicit per-user data directories and migrations. Large PMTiles and 3D assets remain managed release/cache assets rather than being blindly embedded in the executable.

## Development

From tsm-console, run npm install, then npm run desktop:dev. A local bundle can be produced with npm run desktop:build. Release builds require platform signing credentials.
