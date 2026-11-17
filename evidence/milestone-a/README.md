# Posey Building Milestone A — Evidence Package Template

This folder contains **empty templates, not an accepted reconciliation**. Populate the three CSVs from authorized and independently reviewed records. The **23,082** inventory target is not a verified LoD2–LoD4 publication count.

- `manifest.milestone-a.json` — **unfrozen** manifest template; null digests and unverified status are intentional.
- `posey_buildings_source.csv` — one authoritative source building identity per row; no names, owners or street addresses.
- `posey_published_buildings.csv` — only IDs actually represented in the published local 3D Tiles.
- `posey_reconciliation.csv` — one row per source ID, with joint OSM type + ID, match status, real geometry hashes and an independent validation receipt for verified status.
- `posey_style.json` — a 3D Tiles style for a **separate reconciliation overlay** that actually embeds `match_status` and `height_source`. These are NOT built-in Cesium OSM Buildings fields. Do not blindly apply this style to ion asset 96188.
- `scripts/evidence/freeze_milestone_a.py` — deterministic offline tool that hashes the original input bytes and finally hashes the generated manifest.

**Overlay interpretation:** teal = verified matching geometry with a distinct validation receipt; amber = candidate needing review; red = mismatch; grey = unmatched/unavailable. Color is not a survey, roof elevation, wall material or flood classification.

## Freeze only once actual source data exists

```bash
python3 scripts/evidence/freeze_milestone_a.py \
  --source-csv /trusted/posey_official_buildings.csv \
  --published-csv /trusted/posey_published_buildings.csv \
  --reconciliation-csv /trusted/posey_reconciliation.csv \
  --style evidence/milestone-a/posey_style.json \
  --tsm-commit FULL_40_CHARACTER_TSM_COMMIT_SHA \
  --source-uri https://gisdata.in.gov/official-dataset \
  --source-retrieved-at 2026-11-17T12:00:00Z \
  --expected-source-count 23082 \
  --out-dir /trusted/empty/output/frozen-milestone-a
```

The script rejects missing inputs, empty files, duplicate IDs, non-Posey source records, unknown matching states, incomplete reconciliation, missing verification receipt hashes, or an already-filled output directory. It creates both `manifest.milestone-a.json` and `manifest.milestone-a.sha256.txt` in that new output directory **only after input validation**. No fake checksum is tracked in this template. Keep private or license-restricted raw inputs outside public Git.

**Evidence limits:** SHA-256 establishes byte identity only, not authenticity, coordinate accuracy, survey acceptance or regulatory authority. Cesium ion asset IDs are remote visualization references; their bytes are not frozen. Cesium World Bathymetry 2426648 is a global ocean/bathymetry-and-land terrain product, *not* Ohio–Wabash surveyed channel depths. The private `ATphobia22/UnrealEngine` source is not mirrored here or declared compiled/Shipping verified. Human authority final.
