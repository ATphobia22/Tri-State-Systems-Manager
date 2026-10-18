# Spatial Tri-State vs Hardware Tri-State

| Concern | Module | States | Purpose |
|---------|--------|--------|---------|
| **Spatial streaming** | `tsm-console/src/geospatial/spatial-entity-phase.ts` | UNLOADED, DORMANT, ACTIVE | Host RAM proxy vs VRAM glTF payload |
| **Hardware / bus core** | `native/tristate-core` | Inactive, Active, HighImpedance | Register/bus isolation FSM |

Do not store spatial phase inside the 16-bit LOD state word (layout v1).
LOD word contract: `contracts/tsm-state-word-v1.json`.
Draft alternate bit pack (with M bits): `contracts/tsm-state-word-v2-draft.json` — not implemented.
