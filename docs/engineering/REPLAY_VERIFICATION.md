# Replay Verification

## Purpose

Replay verification proves a run is reproducible: the same model, version,
inputs, and configuration produce equivalent outputs.

## Contract

```ts
interface ReplayVerification {
  originalRunId: string;
  replayRunId: string;
  equivalent: boolean;
  differences: string[];
}
```

Implementation: `backend/evidence/replay.py` (`verify_replay`).

## Requirements (all must hold for equivalence)

- Same input manifest hash
- Same config hash
- Same solver name and version
- Same status
- Same output artifact hashes
- Both records' bundle hashes verify (tamper check)

The pasted contract checks only input hash and status. That is not
enough: a replay with a different solver version or config that happens
to reach the same status is not equivalent, and a tampered record must
fail even if its fields match. Tolerances (e.g. stage/flow differences)
are a caller-side engineering judgment and are never applied silently
inside this function.

## Failure behavior

A non-equivalent replay returns `equivalent: false` with each difference
listed. It does not raise and does not block the caller.
