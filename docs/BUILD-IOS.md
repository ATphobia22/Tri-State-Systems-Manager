# Building the TSM iOS App

This document covers producing a signed, installable iOS build (`.ipa`) of
Tri-State Systems Manager.

## What the iOS app is

The iOS app is a **Capacitor 8** wrapper around the production web build in
`tsm-console/dist/`. The native shell is a standard Xcode project at
`tsm-console/ios/App/` (bundle id **`org.tristate.tsm.ios`**, display name
"Tri-State Systems") that loads the bundled web app in a WKWebView. All
application logic, routing, and data ingestion remain the web codebase —
`npm run build` output is copied into the Xcode project with
`npx cap sync ios`.

> **Hard requirement:** compiling and signing an `.ipa` requires **macOS with
> Xcode** and an **Apple Developer Program** membership. None of this can run
> on Linux. Everything up to opening the Xcode project was done on Linux;
> everything below needs a Mac.

## Prerequisites (Mac)

1. macOS with **Xcode 16+** (App Store) including command-line tools:
   `xcode-select --install`.
2. **Node.js 22** and npm 10.9.x (repo pins `node-version: '22'` in CI).
3. An **Apple Developer Program** account (paid membership) with access to
   Certificates, Identifiers & Profiles.
4. A registered **App ID** for `org.tristate.tsm.ios` (Explicit App ID,
   recommended) and at least one provisioning profile:
   - **App Store** distribution profile for TestFlight / App Store.
   - **Ad Hoc** distribution profile (with registered device UDIDs) for
     direct `.ipa` distribution outside the store.
5. An **App Store Connect API key** (for CI uploads; optional for manual
   Xcode flows).

## One-time Apple-side setup

1. In Certificates, Identifiers & Profiles, create the App ID
   `org.tristate.tsm.ios` with the capabilities the app needs
   (none beyond defaults today).
2. Create a **Distribution** certificate (Apple Distribution) and download
   the `.cer`; export the private key as `.p12` from Keychain Access.
3. Create the provisioning profile(s) for the App ID and download them.
4. If you replace the placeholder app icon, drop a 1024×1024 PNG over
   `tsm-console/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
   (the current icon is generated placeholder branding).

## Build the .ipa (manual, Xcode)

From the repo root:

```bash
cd tsm-console
npm ci
npm run build
npx cap sync ios        # copies dist/ into ios/App/App/public
open ios/App/App.xcworkspace
```

In Xcode:

1. Select the **App** target → Signing & Capabilities → choose your **Team**.
   Xcode will resolve the provisioning profile automatically if the App ID
   matches.
2. Set the scheme to **App** and destination to **Any iOS Device (arm64)**.
3. **Product → Archive**. When the archive finishes, the Organizer opens.
4. **Distribute App** and choose:
   - **App Store Connect** → upload to TestFlight / App Store, or
   - **Ad Hoc** → export a signed `.ipa` you can distribute directly
     (devices must be registered in the ad-hoc profile), or
   - **Development** → sideload onto your own registered devices.
5. For TestFlight: after upload, open App Store Connect → TestFlight, wait
   for processing, then add testers.

## Command-line archive (Mac, no Xcode GUI)

```bash
cd tsm-console
npm ci && npm run build && npx cap sync ios

# Archive
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/TSM.xcarchive \
  archive

# Export signed .ipa (ExportOptions.plist: method = app-store | ad-hoc)
xcodebuild -exportArchive \
  -archivePath build/TSM.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist
```

A minimal `ExportOptions.plist` for App Store distribution:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store</string>
  <key>teamID</key><string>YOUR_TEAM_ID</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
```

## CI builds (GitHub Actions)

`.github/workflows/ios-build.yml` runs the full pipeline on `macos-15`:
checkout → Node 22 → `npm ci` → `npm run build` → `npx cap sync ios` →
import signing certificate → `xcodebuild archive` → `xcodebuild
-exportArchive` → uploads `Tri-State-Systems.ipa` as a workflow artifact.

Before the first CI run, the repo owner must add these repository secrets
(see the comment block at the top of the workflow):

| Secret | Contents |
|---|---|
| `APPLE_DISTRIBUTION_CERT_P12` | Base64 of the Apple Distribution `.p12` |
| `APPLE_DISTRIBUTION_CERT_PASSWORD` | Password for the `.p12` |
| `APPLE_PROVISIONING_PROFILE` | Base64 of the `.mobileprovision` file |
| `APPLE_TEAM_ID` | 10-character Apple Team ID |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API Key ID |
| `APP_STORE_CONNECT_API_ISSUER_ID` | App Store Connect API Issuer ID |
| `APP_STORE_CONNECT_API_KEY_P8` | Base64 of the `.p8` API key |

## Releasing a new version

1. Bump `version` in `tsm-console/package.json` **and**
   `tsm-console/src-tauri/tauri.conf.json` stays desktop-only (unrelated).
2. Also bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in the Xcode
   project (or set them in the workflow via `xcodebuild` build settings).
3. `npm run build && npx cap sync ios`, commit, tag, push — CI produces the
   `.ipa` artifact.

## Troubleshooting

- **"No signing certificate found"**: the keychain on the CI runner or the
  local Mac lacks the private key matching the Distribution certificate.
  Re-export the `.p12` including the private key.
- **Provisioning profile doesn't include signing certificate**: regenerate
  the profile after creating the certificate.
- **Blank white screen on launch**: the web bundle failed to copy — rerun
  `npx cap sync ios` and confirm `ios/App/App/public/index.html` is fresh.
- **Network requests fail in the app**: iOS enforces App Transport Security
  (HTTPS only, with narrow exceptions). All TSM data sources are HTTPS;
  if a new HTTP source is added it must be allow-listed in
  `ios/App/App/Info.plist` under `NSAppTransportSecurity`.

## Native data-fabric service (`TSM_API_BASE_URL`)

The iOS target ships a native Swift service,
`ios/App/App/TSMMapDataFabricService.swift`, that fetches live USGS/NOAA
observations from `GET /api/hydrologic/community` with NAVD88 datum tracking
and fail-closed gauge states (`LIVE OBSERVATION` / `STALE` / `CANDIDATE` /
`SOURCE UNAVAILABLE`). It is exposed to the web layer through the
`TSMDataFabric` Capacitor plugin (`ios/App/App/TSMDataFabricPlugin.swift`):

```js
const { TSMDataFabric } = Capacitor.Plugins;
const { stations, error } = await TSMDataFabric.fetchGauges();
```

The API endpoint is configurable via the `TSM_API_BASE_URL` key in
`ios/App/App/Info.plist` (default:
`https://tsm.tristate.org/api/hydrologic/community`). Point it at a staging or
on-device Node API during development; the plugin reads it at runtime, so no
rebuild of the web bundle is needed. Offline fallback records are always marked
`SOURCE UNAVAILABLE` — never presented as live — per the fail-closed doctrine.
