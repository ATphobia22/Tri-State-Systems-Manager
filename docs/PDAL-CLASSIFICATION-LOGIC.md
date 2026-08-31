# PDAL classification logic (explain)

## What “classification” means

ASPRS LAS stores an integer **Classification** per point. Common codes:

| Code | Meaning |
|------|---------|
| 0 | Never classified |
| 1 | Unclassified |
| **2** | **Ground** |
| 3–5 | Low/Med/High vegetation |
| 6 | Building |
| 7 | Low point / noise |
| 9 | Water |
| 17 | Bridge deck (sometimes) |
| 18 | High noise |

Indiana **3DEP QL2** tiles are usually **already classified** by the production vendor. TSM’s first path is **filter**, not reclassify:

```text
read LAS → crop to AOI → keep Classification == 2 → min(Z) in foundation buffer
```

That min(Z) is a **candidate LAG** (DERIVATION). Certified survey LAG remains the regulatory primary for Pure LOMA when sealed.

## How PDAL applies this

1. **`filters.expression`** with `Classification == 2` — keep ground only.  
2. **`filters.range`** (legacy) — same idea with range syntax.  
3. **`filters.assign`** — force classes (e.g. reset to 0 before SMRF).  
4. **Ground algorithms** (only if Class 2 is wrong/missing):
   - **SMRF** — progressive morphological ground (preferred modern PDAL default)
   - **PMF** — progressive morphological (older alternative)
   - **CSF** — cloth simulation
5. **Noise first:** `filters.elm` (low pits) + `filters.outlier` → Class 7, then ignore during SMRF.

## Decision tree for Bonebank

```text
Vendor Class 2 QA OK?
  YES → crop 50–100 ft buffer → Class 2 → min Z  [lag_class2_foundation_buffer.json]
  NO  → ELM → outlier → SMRF → Class 2 → min Z  [ground_reclassify_smrf.json]
```

**Tile constraint:** `IN2020_26800940_12` max ground ~366.5 ft cannot support LAG 377.2 — process **adjacent** tiles after SHA-256 seal.

## Authority

| Output | Class |
|--------|--------|
| LAS on S3 / hash | OBSERVATION |
| PDAL min Class 2 | DERIVATION |
| Sealed survey LAG 377.2 | OBSERVATION |
| LOMA determination | Human + FEMA case **26-05-2022A** |
