# HEC-RAS Surcharge · Indiana DNR Floodplain Regulations

## HEC-RAS surcharge / encroachment (1D steady)

Floodway analysis compares a **base** (natural) profile to an **encroached** profile. Surcharge = WSE_encroached − WSE_base at each section.

| Method | User specifies | Behavior |
|--------|----------------|----------|
| **1** | Left/right stations | Fixed encroachment stations |
| **2** | Fixed top width | Encroach to width |
| **3** | % conveyance reduction | Equal (or proportional) loss from each overbank; no channel intrusion |
| **4** | Target WSE increase | Equal conveyance loss at *target* (higher) elevation |
| **5** | Target WSE + max Δ energy | Method 4 constraints plus energy limit |

Method 4 is commonly used when the target is the allowable surcharge (e.g. 1.0 ft federal default, or stricter state/local).  
**2D unsteady:** Target WS Rise + optional Encroachment Regions; surcharge map = encroached − base.

**TSM:** Report method + target + profile deltas only inside PE-authorized MODEL_OUTPUT artifacts. UI must not present slider-driven ΔWSE as a No-Rise result.

## Indiana DNR regulations (core)

| Instrument | Role |
|------------|------|
| **IC 14-28-1** | Flood Control Act — license for structure/obstruction/deposit/excavation in floodway; abodes generally prohibited |
| **IC 14-28-3** | Floodplain Management Act — local ordinances / minimum standards |
| **312 IAC 10** | Flood Plain Management rules |

**Selected rules**
- **312 IAC 10-4-1:** License required for construction in a floodway (with statutory exceptions).
- **312 IAC 10-3-1:** Local ordinances cover floodway + fringe (or whole flood plain if not split); DNR may delineate; floodway exists even if unmapped.
- **312 IAC 10-3-5:** Buildings >400 ft² in flood plain need flood-protection grade or certified dry floodproofing (non-abode).
- **312 IAC 10-2-3:** “Adversely affect … floodway” means regulatory flood elevation increase of **at least 0.15 ft** (project vs base).

**Practice alignment (from DNR public guidance)**
- DNR Flood Control Act review uses cumulative surcharge policy often described as **0.14 ft** (i.e. adverse threshold at 0.15).
- **FEMA-mapped floodways / NFIP:** local permits typically require **0.00 ft** No-Rise **or** CLOMR/LOMR — independent of DNR’s state surcharge policy.

Always verify current IAC text and local ordinance before engineering conclusions.

## TSM boundary (unchanged)

Inform with citations and evidence packages. Do not license floodway work, issue No-Rise, or auto-compute regulatory surcharge for compliance claims.

