# Native Windows release acceptance — Unreal Engine versus Tauri

**Status: UE 5.8 Windows x64 Shipping release is not yet proven.** This is separate from GitHub's `TSM Windows x64 Offline Runtime` workflow, which builds a **Tauri** native desktop wrapper and web assets. Passing that workflow does not prove an Unreal Engine 5.8 packaged executable or a full offline cinematic digital twin.

## Release evidence needed for issue #414

1. On an authorized Windows x64 runner with UE 5.8 and MSVC, run the project's Unreal BuildCookRun/BuildGraph pipeline in **Shipping** configuration, recording the exact source commit, engine build/version, command, cook results, platform and dependency versions. A `.uproject` alone is not a built application.
2. Export a Windows executable, cooked `.pak` or `.ucas/.utoc` content, required runtime dependencies, and offline terrain/building/imagery data licensed for distribution. Confirm no network dependency on first launch.
3. Run `python scripts/release/verify_unreal_shipping.py --root PATH_TO_UNPACKED_PACKAGE --receipt PRIVATE_BUILD_RECEIPTS/ue-shipping-inventory.json` on the packaging runner. The verifier fails for missing/empty executable or cooked assets and hashes every packaged file.
4. Verify the Unreal engine version, Shipping configuration, source commit, digital signature, local launch, offline startup, packaged data vintages, and hashes using **independent authenticated build receipts**. The SHA-256 inventory alone explicitly leaves these flags false.
5. Upload the distributable package, manifest and independently attested provenance; inspect on a clean Windows 11 x64 host. Publish only if privacy review, 3D Tiles acceptance and scientific limitations are satisfied.

### Critical distinction

`TSM Offline Runtime Build` and `TSM Windows x64 Offline Runtime` currently test non-Unreal software planes. A successful Tauri installer cannot close the UE-specific Shipping release gate.

References: [Epic BuildGraph](https://dev.epicgames.com/documentation/unreal-engine/buildgraph), [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations), [issue #414](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/414), [3D Tiles acceptance issue #416](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416).
