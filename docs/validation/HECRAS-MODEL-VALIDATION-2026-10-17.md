# HEC-RAS Model Validation — 2026-10-17

## Model 4449: JT Myers Pool (Ohio River FIS)

**File:** model-4449-JTMyers-FIS.zip  
**SHA-256:** 938dd9e593f6554b1b7d7095ff11eecc4862bf6c8a6966e88fd6db7f7ff5a7f6

### Acceptance Gate Results

| Gate | Status | Finding |
|------|--------|---------|
| Archive integrity | ✅ PASS | Valid ZIP, 9 files, contents listed |
| Model type | ✅ PASS | HEC-RAS project (.prj, .g01, .f01/.f02, .p01/.p02, .r01) |
| Software version | ✅ PASS | HEC-RAS 3.1.3 (matches catalog) |
| Units | ✅ PASS | English (feet) |
| Vertical datum | ⚠️ CAUTION | **NGVD29** (1929 datum), NOT NAVD88. Conversion required before use with NAVD88 terrain. |
| Reach coverage | ✅ PASS | Ohio River Mile 846 to 773 — covers Mount Vernon / confluence area |
| Study purpose | ✅ PASS | FIS effective 2014-11-05, Uniontown Pool |
| Spatial compatibility | ⏳ PENDING | Cross-section coordinates need verification against AOI |
| Qualified approval | ⏳ PENDING | Requires reviewer sign-off before execution |

### Critical Note: Vertical Datum

The model uses **NGVD29** (1929 datum). Modern terrain uses **NAVD88**. The offset in this region is approximately 0.5–1.0 ft (NGVD29 elevations are higher than NAVD88). **Do not mix without conversion.**

## Model 8778: Unnamed Ohio River Tributary

**File:** model-8778-UNTOhioRiver.zip  
**SHA-256:** 56c60975f0511d6b9f306193c57e7b0b3690139e22c07c0b08c0957e2407b400

| Gate | Status | Finding |
|------|--------|---------|
| Archive integrity | ✅ PASS | Valid ZIP, HEC-RAS project files |
| Model type | ✅ PASS | HEC-RAS 4.1.0 |
| Units | ✅ PASS | English (feet) |
| Classification | ⚠️ CAUTION | APPROX_ZoneA — approximate, not detailed effective model |

## Model 3551: Ethanol Plant (Permit)

**File:** model-3551-ABENGOA.zip  
**SHA-256:** 4d29e9d9f0162c9f38141c257c075dd8d53e34c044a213bfa61f15425ae0d8aa

| Gate | Status | Finding |
|------|--------|---------|
| Archive integrity | ✅ PASS | Valid ZIP, HEC-RAS output files (.O03–O07) |
| Model type | ⚠️ CAUTION | Output files only (.O*), no geometry (.g*) or project (.prj) in archive |
| Classification | ⚠️ CAUTION | PERMIT — project-specific, may not reflect current conditions |

## Summary

- **Model 4449** is the strongest candidate: FIS-effective, covers the right reach, but needs NGVD29→NAVD88 conversion
- **Model 8778** is approximate only — useful for context, not for regulatory analysis
- **Model 3551** has outputs but no geometry — limited reuse value
- **None are approved for execution** until spatial compatibility and reviewer sign-off
