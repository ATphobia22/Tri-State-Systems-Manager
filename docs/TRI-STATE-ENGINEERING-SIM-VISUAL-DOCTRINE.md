# Tri-State Engineering Simulator — Visual Doctrine

**Reference metaphor:** Farming Simulator 17–class grounded simulation (practical landscape, readable machines/fields, operator HUD) — **adapted for Posey County and the Ohio–Wabash Tri-State River Valley engineering**, not entertainment farming.

## What we take from the FS17 reference

| FS17 trait | TSM engineering adaptation |
|------------|----------------------------|
| Huge, readable outdoor world | Exact-scale Posey / Point Township / river corridor from authoritative DEM + survey |
| Authentic equipment & brands | Authentic gauges, FIRM panels, locks/dams, IDNR properties, utilities corridors |
| Work loops (plant → harvest → sell) | Work loops (observe stage → convert datum → assess clearance → evidence package → human decision) |
| Operator-focused UI | Cockpit banners, collapsible settings, BFE/LAG/clearance always visible |
| Co-op / shared farm | Shared Evidence Ledger + human gates (not silent AI governance) |

## What we explicitly reject

- Decorative open-world “game feel” animation loops (water bob, idle camera wander)
- Headless visual effects with no engineering meaning
- Collapsing observation into regulatory determination
- Entertainment physics that fight NAVD88 / EPSG:2966 truth

## Authoritative math (never visual-only)

- Gage height is **GAGE_DATUM**; NAVD88 only after published zero
- LAG − BFE = **+2.2 ft** site lock
- FEMA floodway **0.00 ft** No-Rise vs IDNR **0.15 ft** adverse (312 IAC 10-2-3)
- Compensatory storage default **1.2×** (confirm Posey ordinance)
- Class-2 LiDAR LAG is **support**, not LOMA without sealed survey

## Landscape content priorities (Posey replica)

1. Ohio & Wabash channels, floodplains, Hovey Lake, Twin Swamps
2. John T. Myers Locks and Dam (UNWK2 / 03322420)
3. Bonebank structure elevations (BFE / LAG / FFE / berm)
4. Roads, parcels, power/utility corridors when layers are on
5. NFHL vs Indiana Best Available — never collapsed

## Operator experience goal

Engineers and local/state/federal officials should treat TSM as the **main operating guideline surface**: same clarity FS17 gives a farmer over fields and machines, applied to flood stage, freeboard, storage, and evidence — with **human authority final**.
