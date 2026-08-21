# Prisma schema generation · Amplication — TSM stance

## Prisma

Prisma turns a declarative `schema.prisma` into:

1. SQL migrations (`prisma migrate`)
2. A typed client (`prisma generate`)

Typical flow:

```bash
# DATABASE_URL=postgresql://tsm:...@localhost:5432/tsm_evidence
npx prisma migrate dev --name init_evidence
npx prisma generate
```

TSM ships `prisma/schema.prisma` aligned with EvidenceArtifact:

| Model | Purpose |
|-------|---------|
| `EvidenceArtifact` | Canonical evidence row + CRS + chain JSON |
| `HashVerification` | Fail-closed hash audit |
| `MerkleLeaf` / `MerkleRootSnapshot` | Ledger provenance |

**Guards stay in application code** (`geodetic-guard.mjs`, hash verify) — the ORM does not replace fail-closed policy.

Phase 1 default remains the **file-backed** `evidence-store.mjs`. Prisma is the path when enabling the `postgres` Compose profile.

## Amplication

Amplication is an open-source **backend generator**: data model UI → NestJS modules + Prisma schema + REST/GraphQL + Swagger.

Useful as a **bootstrap accelerator**; TSM does **not** depend on Amplication at runtime.

| Feature | Use for TSM? |
|---------|----------------|
| NestJS + Prisma codegen | Optional prototype of CRUD APIs |
| Live templates / plugins | Org standards only if desired |
| Admin UI | Not a substitute for Trust Fabric / human gate |
| AI entity generation | Review only — never auto-trust as OBSERVATION |

**Rule:** Any generated code is reviewed, then owned as ordinary TypeScript in this repo. No Amplication runtime in production.

