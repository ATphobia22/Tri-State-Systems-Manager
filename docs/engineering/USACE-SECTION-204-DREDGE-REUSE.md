# USACE Beneficial Use of Dredged Material — Deep Dive
## Section 204 (WRDA 1992) and Section 1122 (WRDA 2016) for Berms, Roads, and Erosion-Cutoff Reconnection

**Scope:** Lower Wabash–Ohio Confluence (USACE Louisville District)
**Status:** Engineering planning reference — not legal advice, not a USACE submittal

---

## 1. The authorities

### Section 204, WRDA 1992 (as amended) — Continuing Authorities Program

- **What it does:** Authorizes USACE to plan, design, and build projects for
  the **protection, restoration, and creation of aquatic and ecologically
  related habitats** — including wetlands — **in connection with dredging**
  for construction, operation, or maintenance of an authorized federal
  navigation project. Projects may also **reduce storm damage to property**.
- **Key constraint:** A Section 204 project must be tied to dredging of an
  *existing authorized federal navigation project* (here: the Ohio River
  navigation channel). It **cannot** be used to satisfy mitigation or
  remediation requirements.
- **Process:**
  1. Non-federal sponsor sends a **Letter of Intent** to the USACE district.
  2. USACE performs a **Federal Interest Determination** (federal expense).
  3. **Feasibility study** — 100% federal cost.
  4. If feasible, negotiate a **Project Partnership Agreement (PPA)**.
  5. USACE designs and constructs via private contractor.
- **Cost share (current ERDC CAP fact sheet, Apr 2025):**
  - Feasibility: **100% federal**
  - Design & construction: **65% federal / 35% non-federal sponsor**
  - Lands, easements, rights-of-way, relocations: sponsor-provided
  - O&M after construction: **100% sponsor**
  - **Federal ceiling:** $15M per project (confirm current figure with district)
- **Base plan vs. incremental cost:** Routine disposal is accomplished by the
  least-costly method meeting environmental requirements (the "base plan").
  The *incremental* cost of the beneficial-use alternative above the base
  plan is what gets cost-shared.

### Section 1122, WRDA 2016 — Beneficial Use Pilot Program

- Explicitly pilots **innovative uses** of dredged material, including use
  as **construction or fill material** and for **civic improvement** —
  the closest federal authority to "dredge-to-roadbed."
- Requires a willing, capable non-federal sponsor for cost share / LERRDs.
- Ten pilot projects were authorized nationally; the program demonstrates
  the pathway even where a specific pilot slot is not available, because
  Section 204 remains the standing CAP authority.

### Section 125, WRDA 2020 — Dredged Material Management Plans

- Directs USACE to prioritize plans that **maximize beneficial use** under
  the base plan and Section 204. Useful citation in a Letter of Intent:
  the district is already directed to prefer beneficial use.

---

## 2. Material science: what dredged sediment can build

Ohio River maintenance dredging typically yields sands, silty sands, and
silts. Suitability screening (field/lab verification always required):

| Material | Berm core | Berm shell/armor | Road subbase | Road surface |
|---|---|---|---|---|
| Clean coarse sand / fine gravel | ✓ excellent | ✓ with armor | ✓ excellent | needs stabilization |
| Silty sand | ✓ with compaction control | ✓ with erosion armor | ✓ with drainage | ✗ not alone |
| Silt / clayey silt | marginal — settlement risk | ✓ vegetated | ✗ | ✗ |
| Suspect contaminated sediment | ✗ excluded | ✗ excluded | ✗ excluded | ✗ excluded |

**Required characterization before design:** grain-size distribution,
Atterberg limits (fines), Standard/Modified Proctor compaction curves,
permeability, and (for habitat-adjacent work) sediment chemistry. The twin's
`backend/solvers/geotech.py` Bishop-method solver screens embankment slope
stability from these parameters — inform-only, not a substitute for a
licensed geotechnical engineer.

---

## 3. Application patterns for the confluence

### A. Flood berms from dredged sand

Low berms (3–6 ft) protecting farmsteads, riverside homes, and critical
access roads. Dredged sand forms the core; a clay/silt shell (or imported
clay cap) plus turf/riprap armor controls seepage and erosion. Typical
cross-section: 10–12 ft crest, 3H:1V side slopes. The twin's berm tool
(`tsm-console/src/lib/engineering/berm-road-placement.ts`) computes
cross-sectional area → volume per linear foot → total cubic yards from the
alignment, then prices the Section 204 cost-share split.

### B. Road embankments reconnecting erosion-cutoff land

Where bank erosion severs a county/township road serving riverside parcels
and farms, a replacement alignment on dredged-material fill reconnects the
parcels. Design considerations the twin models:

- Alignment set back from the active cut bank by ≥ the historic erosion
  rate × design life (inform-only screen; geomorphic review required).
- Embankment crown above the BFE + freeboard where the road doubles as
  emergency access.
- Cross-drainage (culverts) sized so the embankment does not dam tributary
  or sheet flow — the twin runs the 2D diffusion-wave screen with and
  without the embankment and reports the backwater delta.
- Haul distance from the dredge placement/stockpile site dominates cost;
  the tool estimates haul cost per cubic yard-mile.

### C. Shoreline / cut-bank stabilization

Targeted placement at actively eroding banks threatening homes, farm
buildings, or roads: dredged sand as backfill behind a riprap or vegetated
geogrid revetment. Section 204's habitat language also supports
wetland-bench designs that pair stabilization with habitat creation —
often the strongest PPA narrative.

---

## 4. Letter of Intent — what the sponsor needs

A county, levee district, drainage board, or municipality can sponsor.
The twin assembles the technical exhibits; the sponsor's board authorizes
the letter. Typical exhibits:

1. Vicinity map + 3DEP hillshade with the problem reach marked.
2. Erosion / flood history (photos with dates, gage records, FIRM panel).
3. Proposed concept: alignment, typical cross-section, cut/fill volumes
   (from the twin's placement tool — labeled screening estimates).
4. Material source: nearest federal navigation dredging reach and
   placement/stockpile location (coordinate with the district's O&M plan).
5. Cost-share math at 65/35 with the $15M federal ceiling noted.
6. Statement of sponsor capability (LERRDs, O&M funding).

**Timeline realism:** CAP projects typically take 2–5 years from LOI to
construction. Emergency streambank protection has separate, faster
authorities (e.g., Section 14) — the twin flags which authority fits the
urgency.

---

## 5. Limits and honest caveats

- Section 204 cannot fund a project whose *primary* purpose is unrelated to
  the navigation-dredging connection; the dredging nexus must be real.
- Beneficial-use material is *available when dredging happens* — schedule
  risk is real; stockpiling adds cost.
- Contaminated sediment is excluded, full stop.
- Nothing in the twin constitutes a USACE commitment, a permit, or an
  engineering certification. Every number the twin produces is a
  screening estimate for human deliberation.

---

## Sources

- ERDC CAP Fact Sheet: Section 204 — Beneficial Use of Dredged Material (15 Apr 2025)
- USACE LRD: "Section 204: Beneficial Use of Dredged Material" (Great Lakes & Ohio River Division)
- WRDA 1992 §204 (33 U.S.C. §2326); WRDA 2016 §1122; WRDA 2020 §125
- TSM repo: `tsm-console/server/ELEVATION-FLOOD-AUTHORITIES.md` (Section 204 summary)
