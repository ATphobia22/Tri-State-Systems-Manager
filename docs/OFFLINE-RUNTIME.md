# TSM Offline Runtime

This package is the reproducible offline installation and build plane for Tri-State Systems Manager.

## Runtime planes

1. Doctor validates source, build, hydraulics, and API artifacts.
2. Dependency preparation materializes the npm cache, Python wheelhouse, and Rust vendor tree.
3. The Vite production build is generated and then reinstalled from the offline npm cache.
4. The existing Node API runtime remains the server boundary.
5. The API health and readiness endpoints are retained as the verification gate.
6. Hydraulic contracts and the read-only HDF5 adapter remain isolated from model authoring.
7. Tauri remains connected to src-tauri; Rust crates are vendored for offline builds.
8. Runtime manifests record artifact hashes and provenance.
9. HEC-RAS itself remains an externally installed, authorized solver.

## Offline installation

Windows:

    ./scripts/offline/install-offline.ps1

Node:

    npm ci --offline --cache offline-runtime/npm-cache

Python:

    python -m pip install --no-index --find-links offline-runtime/python-wheels -r packages/hydraulics/python/requirements.txt

Rust:

    cargo build --offline --manifest-path tsm-console/src-tauri/Cargo.toml

## Artifact policy

The generated bundle contains dependency caches and build outputs. It does not redistribute proprietary HEC-RAS installers. The TSM HEC-RAS adapter remains fail-closed when the authorized solver is absent.

A runtime artifact is valid only when the generated manifest exists and its recorded SHA-256 values match.
