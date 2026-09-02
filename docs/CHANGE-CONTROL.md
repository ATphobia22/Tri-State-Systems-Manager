# TSM Government Engineering Change Control

## Purpose

TSM changes must be traceable, reproducible, and reviewable. This procedure is intentionally compatible with government engineering and audit practices while remaining practical for an open-source repository.

## Change classes

| Class | Examples | Minimum control |
|---|---|---|
| C1 Documentation | README, procedures, explanatory corrections | Reference check + validation |
| C2 Software | application logic, APIs, UI, tests | Tests + type/parse/build gates |
| C3 Data/Geospatial | CRS, datum, site constants, source datasets | Provenance + domain validation + human review |
| C4 Governance/Security | authority rules, permissions, identity, AI policy | Explicit review + security validation |
| C5 Regulatory evidence | sealed survey packages, formal determinations | Licensed/authorized professional and agency review outside TSM |

## Required evidence for C2–C4 changes

Record:

- reason for change;
- affected files/contracts;
- source or authority relied upon;
- expected behavior;
- validation commands and results;
- known limitations or warnings;
- rollback/recovery considerations where applicable.

## Branch and release policy

`main` is the long-lived source of truth. Production artifacts must originate from a commit that passed the repository's required validation gates.

No maintainer may weaken a fail-closed gate merely to obtain a green workflow. If an external platform failure occurs, diagnose the platform failure separately from code correctness.

## Data and geodetic changes

Never change a vertical datum label merely to make values comparable. Raw gage observations remain in their source datum until a documented conversion establishes the target datum. Any conversion must identify source datum, target datum, method, source product, and validation status.

## Governance changes

Changes must preserve the rule that human authority is final. AI-generated analysis is advisory unless a separately approved governance process explicitly assigns a human-reviewed action. TSM must not auto-file or auto-issue regulatory instruments.

## Cleanup changes

Before deleting or consolidating a path, search imports, workflow references, package scripts, documentation links, schemas, migrations, deployment manifests, and runtime loaders. Record the result in `docs/REPOSITORY-CLEANUP-LEDGER.md`.
