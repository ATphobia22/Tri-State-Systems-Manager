# Open Full-Stack Blueprint — TSM alignment

Source pattern: standard React + NestJS-style controllers + vanilla Docker.
**Rule:** TSM ships **portable source**, not a proprietary low-code runtime.

## Principles

1. Generated or hand-written UI uses **plain React** (props, no vendor SDK).
2. API surface is **standard HTTP/JSON** (or future NestJS/Express) with Evidence contracts.
3. Deploy with **stock Node/Postgres images** — stack runs without the tool that authored it.
4. Human authority + fail-closed evidence rules unchanged.

## Mapping to four planes

| Blueprint piece | TSM plane |
|-----------------|-----------|
| Front-end metric cards | Public Visualization / Trust Fabric |
| NestJS-style controllers | Evidence / Governance APIs |
| Docker Compose | Ops — local or edge node |

## Non-goals

- Amplication / proprietary canvas runtime as production dependency
- Client-side “seal” theatre without server Merkle
- Collapsing demo metrics into OBSERVATION authority_class

