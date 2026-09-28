# Agriculture — Tools, Data, and How the Twin Helps

**For:** Farmers, farm families, and ag advisors in the Lower Wabash–Ohio Confluence
**Status:** Screening reference — not agronomic advice, not a USDA determination

---

## 1. What the twin already gives a farm operation

### Flood-exposure acreage (crop insurance & planning)

Run Query 4 in `scripts/geospatial/parcels/postgis_nfhl_parcel_intersection.sql`
grouped to your parcels. It reports **inundated acres per parcel by SFHA zone** —
the exact acreage figure crop-insurance agents and FSA offices ask for when
documenting prevented-planting or flood-loss history.

- Pair with the LOMA-candidate screen (Query 3) for farmstead buildings:
  a farmstead elevated above the BFE may qualify for a LOMA, which can
  change insurance requirements for the structures (not the cropland —
  LOMAs apply to structures/parcels, and cropland flood risk is agronomic,
  not regulatory).

### Terrain & drainage

- **USGS 3DEP LiDAR** terrain tiles (`docs/TERRAIN-LIVE-DATA.md`) give
  field-level elevation at ~1–3 m resolution — use for surface-drainage
  planning, tile-drainage layout screening, and identifying ponding areas.
- The **2D diffusion-wave screening model**
  (`tsm-console/src/lib/hydraulics-diffusion2d.ts`) shows how water moves
  across your fields in a design event — inform-only, for talking with your
  drainage contractor, not for designing the system.

### Soils

- **USDA NRCS Web Soil Survey** is the authoritative soil source:
  https://websoilsurvey.nrcs.usda.gov — map units, drainage class, hydric
  ratings, and productivity indices for every Posey County field.
- The twin does not duplicate Web Soil Survey; it cross-references it.
  When the twin shows a field as both hydric-soil and SFHA-adjacent, that
  is a strong signal to check **wetland determinations** (NRCS) before any
  drainage work — draining a jurisdictional wetland without authorization
  creates real liability.

---

## 2. Conservation & cost-share programs worth knowing

| Program | Agency | What it funds | Note |
|---|---|---|---|
| EQIP | NRCS | Conservation practices: cover crops, grassed waterways, grade stabilization | Local NRCS office; ranking-based |
| CRP / CREP | FSA | Taking flood-prone cropland out of production for conservation | Annual rental payments; strong fit for chronically flooded bottomland |
| LARE | IN DNR Fish & Wildlife | Sediment/logjam removal, aquatic habitat | User-funded via boat fees; sponsor ≥20% cost share; applications ~Jan 15 |
| Section 204 | USACE | Beneficial-use dredged material for berms (see `docs/engineering/USACE-SECTION-204-DREDGE-REUSE.md`) | 65/35 cost share; Letter of Intent to start |
| WRE (ACEP) | NRCS | Wetland reserve easements on frequently flooded farmland | Permanent/30-yr easements; payment for the easement |

**Bottomland strategy note:** Fields that flood 2+ years in 5 are often
worth more in CRP/CREP rental + avoided input costs than in attempted
production. The twin's inundation-frequency screening (scenario runner +
gage history) gives you the numbers to have that conversation with FSA.

---

## 3. Dredged material for farm use

Clean dredged sand from Ohio River maintenance has legitimate farm
applications under Section 204/1122 framing:

- **Farm road / lane embankments** reconnecting fields cut off by erosion.
- **Building pads** for grain bins and equipment sheds (with proper
  compaction and floodplain-permit review — pads in the floodway face
  strict limits).
- **Berms** protecting farmsteads, wells, and fuel storage.

The twin's berm/road placement tool
(`tsm-console/src/lib/engineering/berm-road-placement.ts`) computes
volumes and the 65/35 cost-share math for the sponsor conversation.
**Floodplain permits still apply** — Indiana DNR Division of Water (IN),
IDNR-OWR (IL), or KDOW (KY) depending on the field's state.

---

## 4. Data sources catalog (ag-relevant)

| Data | Source | Access |
|---|---|---|
| Soil surveys | USDA NRCS Web Soil Survey | https://websoilsurvey.nrcs.usda.gov |
| Cropland Data Layer | USDA NASS | https://nassgeodata.gmu.edu/CropScape/ |
| 3DEP LiDAR elevation | USGS | via twin terrain pipeline |
| Parcel boundaries | IGIO (IN) / ISGS (IL) / KyFromAbove (KY) | via twin parcel pipeline |
| SFHA / FIRM | FEMA NFHL | FEMA Flood Map Service Center |
| Streamgages | USGS NWIS | via twin live-data manager |
| Precipitation | NOAA / NWS | climate normals + AHPS |

---

## 5. Boundaries (read this)

- Nothing here is agronomic advice, a USDA determination, or an insurance
  decision. Talk to your NRCS district conservationist, FSA office, and
  crop-insurance agent — the twin prepares you for those conversations; it
  does not replace them.
- Wetland and floodway rules carry real penalties. When in doubt, ask the
  agency before moving dirt.
