# OpenSpec + Agent Skills — Tri-State Systems Manager

**Policy:** Technology informs people; it does not silently govern people. Human authority remains final.

## Adopted process (P0)

| Tool | Role | Install |
|------|------|---------|
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | Brownfield delta specs | `npx @fission-ai/openspec` / see upstream `install.md` |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `/spec` `/plan` `/test` `/review` `/ship` | `npx skills add addyosmani/agent-skills` |

## Brownfield loop

```text
/opsx:explore          # optional
/opsx:propose <name>   # or /opsx:new + /opsx:continue
/opsx:apply
/opsx:archive          # merges ADDED/MODIFIED/REMOVED into openspec/specs/
```

Do **not** baseline the entire monorepo. Spec only what the next change touches.

## TSM non-negotiables (every delta)

1. Presentation ≠ evidence ≠ regulation.
2. No invented CRS, datum, gage-zero, or operator secrets.
3. Fail closed when sources are unpublished or context is lost.
4. MapLibre remains primary map authority; WebGPU is optional assist.
5. Contract tests prove behavior before archive.

## Layout

```text
openspec/
  AGENTS.md
  specs/                 # archived source of truth (grows over time)
  changes/
    <change-name>/
      proposal.md
      design.md          # optional
      tasks.md
      specs/<domain>/spec.md   # DELTA only
```
