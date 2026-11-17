# How to certify production HLOD and UE5.8 Shipping

Certification is **evidence-based**. Scripts never invent a Shipping pass.

## 1. Provenance-safe ingest

```bash
python scripts/geospatial/tsm_data_ingestor.py --init-only

# Stage a tile only with explicit vertical provenance when claiming NAVD88:
python scripts/geospatial/tsm_data_ingestor.py \
  --tile my_tile.laz \
  --expected-sha256 <hex> \
  --ellipsoidal-height-m 120.0 \
  --geoid-offset-m <from_GEOID18_sample> \
  --geoid-model-id GEOID18 \
  --geoid-source-url https://geodesy.noaa.gov/GEOID/GEOID18/
```

No hard-coded site geoid offset. Missing provenance → heights stay unlabeled as NAVD88.

## 2. Production HLOD (not DERIVED_STAGING)

1. Build real GLB/HLOD content for Posey offline package.
2. Write `tiles/posey_county_offline/tileset.json` with non-staging authority extras.
3. Place `.glb` files under the tileset directory.
4. Run ECEF validator: `python scripts/geospatial/tsm_ecef_validator.py`
5. Run certification:

```bash
python scripts/release/tsm_certify_hlod_shipping.py
```

`hlod_production_certified` is true only when tileset exists, GLB count &gt; 0, and authority is not `DERIVED_STAGING`.

## 3. UE5.8 Shipping + air-gap

1. BuildCookRun at an immutable commit on the authorized UE5.8 Windows runner; verify the static package and staged TSMData manifest separately (see `MILESTONE-B-AIRGAP-SHIPPING-GATE.md`).
2. On a **clean Windows 11 host with networking disconnected**, verify the signed installer, launch the installed game with the canonical process smoke test, and capture the receipt:

```powershell
.\scripts\native\Test-OfflineWindows11Shipping.ps1 `
  -PackageRoot "$env:ProgramFiles\Tri-State Systems Manager" `
  -EvidenceDirectory "C:\TSMReceipts\offline-smoke"
```

3. The smoke receipt correctly starts as `PROCESS_START_OBSERVED_INTERACTION_PENDING`. It **cannot** certify Shipping by itself. An independent reviewer must inspect a real headed run (terrain, buildings, gauge/source status, menus, FPS/VRAM), record the source commit and UE5.8 version, verify network disconnection and no localhost/WebView/Node dependency, and create an `INDEPENDENTLY_ACCEPTED` copy with `humanReviewRequired: false`. Its `independentReview` must name the reviewer and UTC review date.
4. The reviewed JSON must contain all explicit verification flags in `scripts/release/shipping_acceptance_evidence.py`, `executableSha256`, and `evidenceArtifacts` with **relative paths and actual SHA-256** for `buildCookRunLog`, `runtimeLog`, `headedScreenshot` (PNG), and `stagedDataManifest`. The UAT log must bind `TSM_SOURCE_COMMIT` to the receipt and report a successful Shipping BuildCookRun. Review identity is recorded but is not cryptographically authenticated by this source gate.
5. Only then run:

```bash
python scripts/release/tsm_certify_hlod_shipping.py \
  --shipping-exe /path/to/TSMNative-Win64-Shipping.exe \
  --airgap-log /path/to/offline-smoke-evidence-reviewed.json \
  --require-full
```

**A text file named an air-gap log, a fabricated .exe, a smoke receipt that only proves process start, or unreviewed screenshots all remain NOT CERTIFIED.** The `--airgap-log` name is retained for CLI compatibility; its value now must be the reviewed JSON evidence receipt.

## 4. Master suite (harness only)

```bash
python scripts/release/tsm_master_verification_suite.py
```

Passes docs/ECEF/archive gates; does **not** set Shipping certified.

Human authority remains final.
