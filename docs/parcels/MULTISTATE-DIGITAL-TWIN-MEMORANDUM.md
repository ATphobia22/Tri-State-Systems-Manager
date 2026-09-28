# Inter-Agency Coordination Memorandum
## Tri-State Digital Twin — Lower Wabash–Ohio Confluence Parcel & Floodplain Program

**Date:** 2026-09-27
**Prepared for:** Community stakeholders, friends, and families of the Lower Wabash–Ohio Confluence region (Posey County IN; Gallatin/White Counties IL; Union/Henderson Counties KY)
**Classification:** Public planning reference — not a legal filing, not an agency submittal

> **Purpose.** This memorandum documents how the Tri-State Digital Twin (TSM)
> parcel-ingestion and flood-screening program coordinates across state and
> federal authorities, what statutory pathways exist for challenging outdated
> flood maps, and how USACE dredged-material authorities can serve community
> flood-protection and connectivity goals. It is inform-only: technology
> informs people; it does not silently govern people. Human authority remains
> final.

---

## 1. Participating authorities and their roles

| Authority | Jurisdiction | Role in this program |
|---|---|---|
| Indiana DNR, Division of Water | IN | State floodplain regulation; Best Available Flood Hazard data; floodplain construction permits |
| Indiana GIO (IGIO) | IN | Statewide parcel framework (2025 Data Harvest); orthoimagery & LiDAR program |
| Illinois ISGS | IL | Statewide parcel FeatureServer (cadastral reference) |
| IL DNR Office of Water Resources | IL | Illinois floodplain regulation; state floodway permits |
| Kentucky Division of Water (KDOW) | KY | Kentucky floodplain regulation; NFIP state coordination |
| KyFromAbove / Kentucky GIS | KY | Statewide parcel FeatureServer (cadastral reference) |
| USACE Louisville District | Federal (OH River) | Navigation O&M dredging; Section 204 beneficial-use sponsor; Section 205 flood-risk studies |
| FEMA Region 5 (IL/IN) & Region 4 (KY) | Federal | NFIP map administration; LOMA/LOMR determinations (Forms MT-1/MT-2) |
| USGS | Federal | 3DEP LiDAR elevation; streamgage network; authoritative terrain |

**Data-sovereignty rule.** Each state's parcel data remains that state's
cadastral reference. TSM ingests copies into a provenance-tracked PostGIS
store (EPSG:2966) for *screening* — the ingested copy never replaces the
source agency as authority, and nothing in the twin is a survey.

---

## 2. USACE hydraulic mechanics in the confluence reach

The Ohio River in this reach is a **navigated, pooled river**. Understanding
the hydraulics matters because map challenges and berm/road designs must
account for them:

- **Navigation pools.** Locks and dams (including the J.T. Myers Locks and
  Dam upstream reach) maintain permanent navigation pools. A pool holds the
  river surface at an engineered elevation across a wide range of flows —
  this is a *lateral hydraulic head* imposed on the adjacent alluvial valley.
- **Alluvial water-table coupling.** In the Wabash–Ohio bottomlands, the
  shallow alluvial aquifer is hydraulically connected to the river. A raised
  pool stage elevates the water table laterally into tributary valleys
  (e.g., Willow Pond Slough–Wabash systems), reducing soil storage and
  drainage capacity during coincident rainfall.
- **Tributary backwater.** When the Ohio/Wabash main stem is high, tributary
  mouths experience backwater — water-surface profiles flatten and flood
  extents push upstream beyond what a "normal depth" assumption predicts.
  Screening models that ignore backwater understate confluence flooding.
- **Drainage-capacity alteration.** Levees, berms, roads on fill, and
  dredged-material placements all change local conveyance and storage.
  Every proposed placement in the twin is therefore run through the
  screening hydraulics (2D diffusion-wave) *before* any human decision —
  inform-only, never self-approving.

**Implication for map challenges:** a FIRM panel whose hydraulic model
predates pool-operation changes, or that used coarse terrain where 3DEP
LiDAR now exists, is challengeable on technical grounds (see §4).

---

## 3. USACE Section 204 — beneficial use of dredged material for berms and roads

**Authority.** Section 204 of the Water Resources Development Act of 1992,
as amended (Continuing Authorities Program). USACE may plan, design, and
build projects that **protect, restore, or create aquatic and ecologically
related habitats** — or **reduce storm damage to property** — *in connection
with* dredging for construction, operation, or maintenance of an authorized
federal navigation project.

**Why it matters here.** The Louisville District routinely maintenance-dredges
the Ohio River navigation channel. That dredged sediment — often clean sand
and silt — is a potential construction material for:

1. **Flood berms / low levees** protecting riverside communities and
   farmland cut off by erosion;
2. **Road embankments** reconnecting land parcels isolated when
   riverbank erosion severs access roads;
3. **Shoreline stabilization** at eroding cut banks threatening homes,
   farmsteads, and county roads.

**Program mechanics (current ERDC fact sheet, 2025):**

- **Start:** written Letter of Intent from a non-federal sponsor (county,
  levee district, municipality, or state agency) to the USACE district.
- **Feasibility study:** 100% federal cost.
- **Design & construction:** typically **65% federal / 35% non-federal**
  cost share.
- **Federal ceiling:** commonly cited $10M–$15M per project (confirm with
  the district; varies by authorization vintage).
- **O&M:** 100% non-federal after construction.
- **Cannot** be used to meet mitigation or remediation requirements.
- **WRDA 2016 §1122** additionally authorizes pilot projects using dredged
  material explicitly as *construction/fill material* and for civic
  improvement — the closest authority to "dredge-to-roadbed."

**Material suitability (engineering screen, not a certification):**

- Clean coarse sand/gravel → structural fill, road subbase, berm cores.
- Silty material → berm shells with proper compaction and erosion armor;
  generally unsuitable as road wearing surface without stabilization.
- Contaminated sediment → excluded from beneficial use; follows the
  base-plan disposal path.
- Every placement needs geotechnical characterization (gradation,
  Atterberg limits, compaction curves) — the twin's `geotech.py`
  Bishop-method solver screens slope stability; it does not replace a
  licensed geotechnical engineer.

**Erosion-cutoff reconnection concept.** Where bank erosion has severed a
road serving riverside parcels/farms, the twin's road/berm placement tool
(§6 of the engineering docs) generates candidate alignments with cut/fill
volumes from 3DEP terrain; Section 204/1122 dredged material is modeled as
the fill source. Volumes, haul distances from the dredge placement site,
and cost-share math are computed inform-only for the sponsor's Letter of
Intent.

---

## 4. Statutory pathways for challenging outdated flood maps

1. **44 CFR Part 67 — appeals of proposed base flood elevations.**
   When FEMA proposes new or revised BFEs, communities and individuals may
   appeal on the basis of *technical* data (better topography, better
   hydrology/hydraulics). Government-approved USGS 3DEP LiDAR is the
   strongest widely-available basis.

2. **Letter of Map Amendment (LOMA) — 44 CFR §70.** Removes a *structure or
   parcel* from the SFHA when certified elevation data shows it above the
   BFE. Filed on FEMA Form MT-1. The twin's LOMA screen (Query 3 in
   `postgis_nfhl_parcel_intersection.sql`) identifies *candidates*; only a
   FEMA determination grants a LOMA.

3. **Letter of Map Revision (LOMR) — 44 CFR §72.** Revises the map itself
   (BFE, floodway, zone boundaries) based on new technical data — e.g., a
   berm, channel change, or superior terrain. Filed on Form MT-2; requires
   community concurrence and typically HEC-RAS modeling.

4. **Administrative Procedure Act (5 U.S.C. §706).** Final agency actions
   (including map determinations) are subject to judicial review under the
   APA's arbitrary-and-capricious standard. A well-documented technical
   record — LiDAR terrain, gage analysis, hydraulic modeling, and a clean
   provenance chain — is what makes such review viable. The twin's
   evidence-manifest discipline (SHA-256 manifests, transformation chains)
   exists to build exactly that record.

**What the twin does and does not do:** it assembles the technical record
and screens candidates. It does not file anything, does not certify
elevations, and does not predict FEMA outcomes.

---

## 5. Data pipeline summary

```
ISGS (IL) ──┐
KyFromAbove ─┼──▶ ogr2ogr ──▶ EPSG:2966 ──▶ parcel_staging_raw ──▶ parcel_provenance
IGIO (IN) ──┘        (auto-detect source CRS)      (validate/quarantine)   (VERIFIED/STALE)
                                                        │
FEMA NFHL S_Fld_Haz_Ar ──▶ nfhl_sfha (EPSG:2966) ────────┼──▶ intersection queries
                                                        │         (zone, inundated %, freeboard)
USGS 3DEP LiDAR ──▶ terrain tiles ──▶ flood sim ─────────┘
```

All scripts live in `scripts/geospatial/parcels/`. Run order:
`parcel_provenance_schema.sql` → `ingest_tristate_parcels.sh` →
load NFHL extract → `postgis_nfhl_parcel_intersection.sql`.

---

## 6. Community use

This system exists for the surrounding communities, friends, and families
of the confluence — not for any agency. Practical uses:

- A family checking whether their parcel screens as a LOMA candidate
  before paying for a survey.
- A township trustee scoping a Section 204 Letter of Intent with real
  cut/fill volumes.
- A farmer quantifying SFHA acreage for crop-insurance and conservation
  planning (see `docs/agriculture/`).
- Neighbors reconnecting over shared, accurate maps instead of rumors.

No submission, registration, purchase, or external contact is made by the
twin itself. Every outward step requires explicit human authorization.
