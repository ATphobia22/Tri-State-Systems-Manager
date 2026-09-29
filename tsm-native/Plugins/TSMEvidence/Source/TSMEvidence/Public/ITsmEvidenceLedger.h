#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// SHA-256 hashing, attestation, and the evidence ledger for frames,
// scenarios, and simulation snapshots. Merkle-chained; fail-closed.
class ITsmEvidenceLedger {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual bool HashBytes(const unsigned char* data, int len, char outHex64[65]) = 0;
    virtual bool AttestSnapshot(const char* snapshotId, const char* sha256Hex) = 0;
    virtual bool VerifyChain(const char* snapshotId) = 0;
};
