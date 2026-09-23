# TSM Native C++ Dependencies

This directory is the reproducible dependency manifest for the Sovereign Native C++ layer.

## Direct dependencies

- SQLite3 with RTree, FTS5, and JSON1.
- SpatiaLite without optional GCP/RTTOPO features.

SpatiaLite's transitive build dependencies are resolved by vcpkg.

## Reproducibility

The vcpkg registry is pinned to commit:

`5f96cd15fd745122cf27e0524606d6c1efc5fd07`

Do not replace the baseline with a moving branch name.

The bootstrap scripts clone vcpkg outside the repository's source tree, bootstrap it with telemetry disabled, and install the manifest into vcpkg's per-manifest `vcpkg_installed` directory.

## Usage

Windows / PowerShell:

```powershell
./scripts/native/Bootstrap-NativeDependencies.ps1 -Triplet x64-windows
```

macOS:

```bash
./scripts/native/Bootstrap-NativeDependencies.sh arm64-osx
```

Linux:

```bash
./scripts/native/Bootstrap-NativeDependencies.sh x64-linux
```

Use `-InstallToolchain` on Windows/PowerShell when CMake/Ninja are absent and the host package manager is available.

## Runtime boundary

These are native libraries, not network services. Their presence does not authorize the Sovereign Native runtime to contact remote data providers.

Production deployment must package the exact native libraries used by the build, together with license notices and SHA-256 artifact manifests.

Unreal Engine itself is not redistributed through this repository. A licensed UE installation remains a host prerequisite for UE packaging.
