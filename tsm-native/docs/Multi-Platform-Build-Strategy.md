# TSM Native Multi-Platform Build Strategy

## Supported build lanes

| Target | Architecture | Native artifact | Graphics/runtime |
|---|---|---|---|
| Windows | x64, arm64 | DLL/EXE | DirectX 12 / Vulkan |
| macOS | arm64, x86_64 | dylib/app | Metal |
| iOS/iPadOS | arm64 | framework/XCFramework or static native artifact | Metal |
| Android | arm64-v8a, x86_64 | .so/APK/AAB | Vulkan / OpenGL ES |
| Linux | x86_64, arm64 | .so/ELF | Vulkan |

The numerical C++ core remains platform-neutral. Platform-specific SDKs, graphics APIs, signing, packaging, and native-library formats are isolated at the platform boundary.

## Windows

Use Visual Studio/CMake presets for local development. Production artifacts must be Authenticode signed. MSIX can be used for managed distribution; MSI/EXE remains supported for direct enterprise deployment.

## macOS

Build native code for Apple Silicon and Intel where required. Release applications must use Developer ID signing, Hardened Runtime, and notarization. Verify every nested executable/library before packaging.

## iOS/iPadOS

Do not ship a macOS-style dynamic dylib as the application dependency. Package native code using the Apple-supported framework/XCFramework/static-library model. Device builds target arm64.

## Android

Use the Android NDK and CMake toolchain. Produce explicit ABI targets for arm64-v8a and x86_64. Keep the numerical core free of platform APIs.

## Sovereign runtime

All platform builds inherit the same fail-closed runtime contract:

- no browser
- no Node.js runtime
- no localhost service
- no network data providers
- no mutable evidence snapshot
- verified local datasets only

Connected telemetry belongs in a separately governed Connected Mode and must never silently activate in Sovereign Mode.

## Reproducibility record

Every release should record:

- Git commit
- compiler/toolchain version
- CMake version
- Unreal Engine version
- platform SDK version
- Android NDK version when applicable
- vcpkg baseline
- target architecture
- dependency ABI/cache identity
- SHA-256 of packaged native libraries
- signing/notarization status
- dataset manifest hash

## Build tiers

1. PR gate: source compile + unit tests + policy validation.
2. Platform probe: dependency acquisition and ABI/file validation.
3. Self-hosted package gate: UE Shipping package per platform.
4. Release gate: artifact hashes + signatures + notarization/store packaging checks.
5. Evidence gate: immutable dataset manifest + provenance + reproducibility metadata.

Never promote a platform artifact from a lower tier directly to evidence/release status.
