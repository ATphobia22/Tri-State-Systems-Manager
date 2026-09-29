# TSM Crypto (Scaffold + verified core)

Dedicated cryptographic layer for dataset attestation and frame attestation.

**Status: scaffold.** The plugin descriptor and Blueprint wrapper ship as
scaffolding: they require Unreal Engine 5.8+ on Windows to compile and have
not been built or tested in this environment.

**Verified core:** `Source/TSMCrypto/Public/TsmSha256.h` and
`Source/TSMCrypto/Private/TsmSha256.cpp` are pure C++ (no UE headers) and
implement genuine SHA-256 per FIPS 180-4 with zero external dependencies
(no OpenSSL, no CryptoPP — suitable for the air-gapped build). The
implementation was compiled with g++ and checked against five NIST test
vectors (empty, "abc", 448-bit, 896-bit, 1M×'a'), all passing, cross-checked
against an independent reference implementation.

**Correction history:** an earlier draft of this module hashed with
`FMD5::HashAnsiString` (MD5) and a later draft with `FSHA1` (SHA-1) while
labeling the result "SHA-256". Both were wrong and are replaced by this
module. Do not reintroduce MD5/SHA-1 under a SHA-256 name.

Roadmap: SHA-512, Merkle trees, dataset attestation, frame attestation.
