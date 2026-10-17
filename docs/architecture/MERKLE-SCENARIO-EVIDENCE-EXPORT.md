# How Merkle-stamped scenario evidence export works

**Date:** 2026-10-17 · **Authority:** SCENARIO / SIMULATION_DEMO only

## Purpose

Give a human a **content-addressed, downloadable receipt** for a Scenario Studio cascade run so the same numbers can be audited later. It does **not** create regulatory, observed, or warning authority.

## Flow

```text
1. User runs Scenario Studio (event × adaptation × facility inventory)
2. Result object is in memory (residual risk + per-facility scores)
3. User clicks "Export Merkle-stamped package" (optional reviewer/reason)
4. Client builds canonical JSON body:
     kind, authorityClass=SCENARIO, label=SIMULATION_DEMO,
     evidence_id, result, optional reviewer fields, stamped_at, disclaimer
5. leafHash = SHA-256( "TSM_LEAF:" + canonicalJSON )
6. Leaf is append-only prepended to the browser ledger (localStorage key tsm_merkle_ledger_v1)
7. merkleRoot = Merkle root over ordered leaf hashes (domain-separated "TSM_NODE:" pairs)
8. Browser downloads tsm-scenario-<evidence_id>.json containing:
     evidence_id, sha256_hash, merkleRoot, full scenario, ledgerSnapshot, disclaimer
```

## Domain separation

| Prefix | Use |
|--------|-----|
| `TSM_LEAF:` | Hash of a single evidence payload |
| `TSM_NODE:` | Hash of left+right child hashes when building the tree |

This matches the main Evidence Ledger client (`lib/merkle.ts`) and resists trivial second-preimage confusion between leaves and internal nodes.

## What is **not** claimed

| Claim | Status |
|-------|--------|
| OBSERVED hydrology | **No** |
| REGULATORY / SFHA | **No** |
| Server-authoritative root | **No** (client cache only) |
| Human-authorized production seal | Optional reviewer fields stamp *intent*; they do **not** set `human_authorized` on the production evidence path |

## Relation to production `appendEvidence`

`appendEvidence` in `merkle.ts` requires explicit Human Authority Sign and is intended for higher-assurance paths. Scenario export uses a parallel **scenario_export** governance status so cascade runs cannot be mistaken for signed OBSERVED blocks.

## Verification recipe (offline)

1. Open the downloaded JSON.
2. Recompute `SHA-256("TSM_LEAF:" + canonicalBody)` — body fields must match the stamped payload.
3. Recompute Merkle root over the ledger leaf hashes in oldest→newest order using `TSM_NODE:` pairing.
4. Confirm `authorityClass === "SCENARIO"` and `label === "SIMULATION_DEMO"`.

## Fail-closed notes

- Export never invents cascade scores; it only stamps the in-memory result.
- Missing reviewer fields still allow a local stamp (pending / scenario_export).
- Clearing browser storage clears the client ledger — treat downloads as the durable artifact.
