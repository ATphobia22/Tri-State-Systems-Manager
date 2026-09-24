# Branch merge record — 2026-09-24

This commit integrates the remaining repository branches into main using an audited octopus merge.

Branches merged as parents:
- fix/ci-native-installer-final-2026-09
- fix/ci-tauri-signing-native-manifest-2026-09-23
- fix/native-dependency-bootstrap-2026-09
- fix/restore-production-reliability-gate-2026-09
- Multi-Installer

Resolution rule:
- Non-conflicting branch changes were carried into the merge tree.
- Conflicting edits were retained from the then-current main tree because these branches were materially behind main and their affected files had independently evolved.
- The complete branch histories remain reachable as merge parents for provenance and auditability.

Previously merged dependency branches (actions/attest, actions/download-artifact, lucide-react, and the React DOM/type update) are already ancestors of main and therefore require no additional parent.

This record does not change regulatory authority, evidence status, or human-approval gates.
