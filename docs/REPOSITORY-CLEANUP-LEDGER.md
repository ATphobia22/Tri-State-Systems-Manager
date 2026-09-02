# TSM Repository Cleanup Ledger

**Date opened:** 2026-09-02  
**Disposition:** Conservative cleanup; no authoritative historical evidence deleted

## Changes completed

| Path | Action | Reason | Evidence |
|---|---|---|---|
| `README.md` | Rewritten | Previous README mixed operator, promotional, and engineering language and contained stale/ambiguous quickstart references | Current package scripts, FIRM SSOT, ADR-005/006, CI workflow |
| `GOVERNMENT_QUICKSTART.md` | Rewritten | Corrected stale FIRM panel reference and removed nonexistent `scan:loma` command; aligned commands with package scripts | `tsm-console/package.json`; `tsm-console/src/lib/firm-panel-ssot.ts` |
| `.github/workflows/ci.yml` | Hardened | Added bounded primary-job execution while preserving existing fail-closed gates and `contents: read` permissions | Existing green CI design and workflow inspection |
| `docs/REPOSITORY-STRUCTURE.md` | Added | Establish canonical directory ownership and cleanup rules | Current repository layout |
| `docs/CHANGE-CONTROL.md` | Added | Establish government-engineering change evidence requirements | Current governance model |
| `docs/superpowers/specs/2026-09-02-repository-remediation-design.md` | Added | Record approved remediation design | Approved 2026-09-02 remediation scope |
| `docs/superpowers/plans/2026-09-02-repository-remediation.md` | Added | Record implementation plan and verification requirements | Approved remediation design |

## Deletion decision

**No existing production, data, evidence, regulatory, historical, or research file was deleted during this cleanup pass.**

The repository contains legacy FIRM panels and LOMC records, including `18129C0265C` and `18129C0215C`, that are referenced by evidence manifests, tests, or historical case records. They are therefore retained. The current FIRM SSOT separately identifies `18129C0300C` as the canonical NFHL point-identify result.

## Known structural follow-up

Some legacy filenames and historical documents can be consolidated later, but only after a complete repository-wide reference graph is available. This ledger intentionally prefers traceability over aggressive deletion.

## Required rule

A future cleanup may delete a path only after documenting its generated/temporary status, exact duplication, or explicit supersession and recording the evidence here.
