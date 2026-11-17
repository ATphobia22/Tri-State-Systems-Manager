# TSM native Windows: offline + optional online distribution

Updated 2026-11-16. **Status: source implementation, Windows binary not yet built or independently verified.**

## Separate deliverables

| Artifact | Build input | Install-time network | Installed application network |
| --- | --- | --- | --- |
| `TSM-Native-Setup-<version>-windows-x64.exe` | UE5.8 Win64 Shipping, staged TSMData, native DLLs, Inno Setup 7 and signer | No | No required network |
| `TSM-Online-Setup-<version>-windows-x64.exe` | Exact release tag + SHA-256 of the FINAL signed offline installer | Yes, GitHub Release HTTPS | No required network |

The online bootstrapper **does not** download terrain, buildings or model resources individually. It downloads the complete offline installer, verifies the compile-time-pinned SHA-256 using Inno Setup's native download API, and invokes it. The original full offline setup remains available and usable without network access. Network failure or hash mismatch must never launch the downloaded executable.

The online bootstrapper is currently a small independent installer wrapper with `CreateAppDir=no` and `Uninstallable=no`; the full setup performs installation and owns the uninstall entry. For signed release verification the online bootstrapper is a **fifth** executable distinct from the existing four signed native release artifacts.

## Nonblocking trust and release labeling

`scripts/native/Report-PublicAuthenticodeTrust.ps1` produces a nonblocking JSON advisory with the observed signing status, code signing EKU (OID `1.3.6.1.5.5.7.3.3`), timestamp certificate presence, publisher subject if configured, SignTool verification on the runner, SHA-256, and independent-Windows-11 evidence explicitly marked `NOT_EVIDENCED`. This reporting step uses `if: always()` and `continue-on-error: true`. An advisory status never authorizes public publication and must never be represented as certificate issuance, regulatory approval, or a clean offline run.

The existing native signed offline installer workflow retains its preexisting packaging/signing dependencies; **only the newly added trust reporting is non-blocking**. If signing is not provisioned, use the **optional** online bootstrapper preview workflow for build experiments. The preview is labeled unsigned/unverified unless its own certificate is verified; do not publish it as a trusted public installer.

Production requires owner-verified publisher identity and a trusted Authenticode signer. `New-SelfSignedCertificate` and `MakeCert` do not provide public publisher trust. Prefer Azure Artifact Signing with approved identity, least-privilege GitHub OIDC and protected release permissions for production; it needs a new signing adapter rather than simply substituting secrets into TSM's current local `signtool /sha1` mechanism. No certificate/private key is created, uploaded, or enrolled by this implementation.

## Build an online bootstrapper

1. Build, sign, and separately verify the full offline installer using an approved Windows runner, then compute the SHA-256 of the **final bytes after signing**.
2. Publish that offline installer to the matching public GitHub Release, such as `v1.0.0`, under its exact filename.
3. Manually dispatch **TSM Online Installer (optional, checksum-pinned)** with `release_tag=v1.0.0` and `offline_sha256=<64-hex checksum>`. It installs pinned Inno Setup 7.1.1, compiles the online setup, uploads the preview executable plus JSON receipt, and attests the build's origin. It does not publish to GitHub Releases.
4. Sign the compiled online executable with a legitimate trusted publisher certificate and RFC 3161 timestamp. The build wrapper supports local certificate-store signing when a thumbprint and timestamp URL are supplied. Run SignTool verification and update the final online SHA-256 after signing.
5. Independently test both installers on a clean Windows 11 x64 VM. Verify public trust and hashes while online, then disconnect the network and confirm TSM's native startup and visual scenes work without it.
6. Only then make the online executable a public release asset alongside its full offline counterpart, with both hashes and explicit known limitations.

To compile on a configured Windows 11 machine without GitHub Actions:

```powershell
$offline = 'dist\installer\TSM-Native-Setup-1.0.0-windows-x64.exe'
.\scripts\native\Build-TSMOnlineInstaller.ps1 -ReleaseTag v1.0.0 -OfflineInstallerPath $offline
```

For the remote workflow, supply the actual SHA-256 of the *same final signed offline installer* as the `offline_sha256` input. The workflow does not download the huge UE package just to compile its small launcher. The pinned release URL must exist and be public when end users run the online bootstrapper; its availability is **not proven** by the compile step.

The compile uses the exact URL:

`https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/download/v1.0.0/TSM-Native-Setup-1.0.0-windows-x64.exe`

No arbitrary mirror, tag, or user-entered hostname is accepted by the packaging script.

## Primary references

- Microsoft code-signing options: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Microsoft SignTool: https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool
- Azure Artifact Signing integration: https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations
- Inno Setup downloading + pinned SHA-256: https://jrsoftware.org/inno-setup/documentation/topic_isxfunc_downloadtemporaryfile.htm
- Inno download wizard: https://jrsoftware.org/inno-setup/documentation/topic_isxfunc_createdownloadpage.htm
- Inno Setup compiler parameters: https://jrsoftware.org/inno-setup/documentation/topic_compilercmdline.htm
- Inno Setup 7.1.1 release: https://github.com/jrsoftware/issrc/releases/tag/is-7_1_1

## Separate experimental alternatives

`ATphobia22/msix-packaging` and `ATphobia22/winappCli` may assist a future opt-in MSIX package, but they do not replace native Unreal's complete offline payload or bypass signing requirements. WinApp CLI is in public preview. Windows activation tools do not create a lawful code-signing identity and must not be integrated.

## Release evidence still required

- Actual UE5.8 Windows Shipping cook and staged native dependencies.
- Complete verified TSMData, including applicable terrain and 3D building tiles, with provenance.
- Real signed offline setup and independently signed online executable, with timestamps and immutable checksums.
- Successful online-download smoke test (including corrupted download rejection, missing asset and cancellation).
- Independently validated signature chain on a clean Windows 11 VM with no imported development root.
- Offline startup, headed rendering, FPS/VRAM evidence, and explicit distinction from FEMA/USGS/DNR regulatory certification.
