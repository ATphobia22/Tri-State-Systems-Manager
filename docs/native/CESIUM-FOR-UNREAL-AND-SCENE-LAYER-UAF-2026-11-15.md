# Cesium for Unreal + Scene Layer UAF (2026-11-15)

## Naming (no duplicates)

| Name | Exists? | Role |
|------|---------|------|
| **`UTSMSceneLayerSubsystem`** | Yes | World subsystem: visibility, registration, profiles |
| **`ATSMSceneLayerManager`** | **No** | Not a type in this repo — tests target the subsystem |
| **`ATSMOfflineTileset`** | Yes | Spawns `ACesium3DTileset`, registers with subsystem |
| **`CesiumRuntime` / CesiumForUnreal** | Declared | `.uproject` plugin + `TSMNative.Build.cs` |

Do not add a second manager class that duplicates `UTSMSceneLayerSubsystem`.

## Cesium integration (already implemented)

1. **Plugin:** `CesiumForUnreal` enabled in `tsm-native/TSMNative.uproject`.
2. **Module:** `CesiumRuntime` public dependency in `TSMNative.Build.cs`.
3. **Runtime:** `TSMOfflineTileset.cpp`:
   - Requires tileset JSON under `Content/TSMData/` (path jail).
   - Spawns `ACesium3DTileset`, `FromUrl` + `file://` URL.
   - Registers the **Cesium actor** (not the wrapper) on Terrain / Buildings / Roads.
   - `bSourceVerified` stays **false** — SHA is integrity, not engineering certification.

Web Cesium twin remains separate (`tsm-console` / ion / Pages).

## UAF tests

File: `Source/TSMNative/Private/Tests/TSMSceneLayerSubsystem.spec.cpp`

| Test | Asserts |
|------|---------|
| `TSM.SceneLayer.DefaultVisibility` | Terrain–Roads on; Floodplain+ off; `SOURCE_UNAVAILABLE` without actors |
| `TSM.SceneLayer.VisibilityToggle` | SetLayerVisibility lens transitions |
| `TSM.SceneLayer.RegisterRejectsBadSha` | Null actor / bad SHA / empty id rejected |
| `TSM.SceneLayer.ProfileNameSafety` | Unsafe profile names rejected; safe save/load |

```text
UnrealEditor-Cmd.exe TSMNative.uproject -ExecCmds="Automation RunTests TSM.SceneLayer;Quit" -unattended -NullRHI
```

Requires a local UE 5.8 Editor install. CI without Unreal cannot execute these binaries.

## Signed Shipping certificate — honesty gate

This environment **cannot**:

- Run UnrealBuildTool / cook / stage a Win64 Shipping package
- Hold or create your Authenticode **code-signing certificate**
- Produce a trusted `signtool` signature for distribution

**On your Windows build host (with UE 5.8 + cert):**

1. Build/cook Shipping via `scripts/native/Build-TSMShipping.ps1` or UAT.
2. Sign with your org cert, e.g.  
   `signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a path\to\TSMNative-Win64-Shipping.exe`
3. Verify: `signtool verify /pa /v path\to\exe`
4. Archive verify output + binary SHA-256 as evidence (not a FEMA/survey seal).

Template checklist: `docs/native/SHIPPING-SIGN-RECEIPT-TEMPLATE.md`.
