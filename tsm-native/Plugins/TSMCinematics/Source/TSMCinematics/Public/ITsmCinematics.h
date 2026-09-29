#pragma once
// Scaffold interface — pure C++ (no UE headers). Requires Unreal Engine 5.8+ on Windows to compile.
// Sequencer control and evidence compositing for the cinematic fabric
// (Unreal render -> Natron -> Avid chain).
class ITsmCinematics {
public:
    virtual const char* ServiceName() const = 0; // registers with TSMCore ITsmServiceRegistry
    virtual bool PlaySequence(const char* sequenceId) = 0;
    virtual bool RenderFrame(long long frameNo, const char* outPath) = 0;
    virtual bool AttachEvidence(const char* frameId, const char* snapshotId) = 0;
};
