# Indiana Elevation Catalog & IFA Flood Control — Verified 2026-08-19

## Indiana Statewide Elevation Catalog (VERIFIED)

| Field | Value |
|-------|--------|
| Name | Indiana Statewide Elevation Catalog |
| Managed by | Indiana Geographic Information Office (IGIO) + IOT |
| Documentation | https://elevation.gio.in.gov/ |
| Contact | sscholer@iot.in.gov |
| License | **CC0** (Creative Commons Zero) |
| AWS ARN | `arn:aws:s3:::giselevationingov` |
| Region | us-east-2 |
| Public list | `aws s3 ls --no-sign-request s3://giselevationingov/` |
| Browser | https://giselevationingov.s3.amazonaws.com/index.html |
| Registry | https://registry.opendata.aws/in-elevation |

### Collections
- 2011–2013 statewide LiDAR (QL3 era)
- 2016–2020 NRCS-funded collection (QL2 in many areas)
- Uncompressed **LAS** tiles; tile names = lower-left coordinate
- 2025–2028 ortho + LiDAR cycle by **Tiers** (South→North county groups)

### Access paths for TSM
1. S3 LAS for scientific/terrain processing (Evidence Plane acquisition)
2. DEM/DTM/DSM via IGIO partners (ISDP, Purdue Forestry, STAC)
3. Dynamic REST imagery/DEM services (hillshade, slope, aspect) — derived products

**TSM rule:** LiDAR/DEM acquisition → EvidenceArtifact with `authority_class: OBSERVATION` or terrain product class; GPU/NDVI/hillshade → `DERIVED` / `VISUALIZATION`.

Previously `indiana_elevation` was PROVISIONAL; **now VERIFIED** via AWS Open Data registry + elevation.gio.in.gov.

---

## IFA Flood Control Revolving Fund (VERIFIED)

| Field | Value |
|-------|--------|
| Program | Flood Control Revolving Fund |
| Statute | IC 5-1.2-13 (program); administered by IFA SRF |
| Transfer | From DNR to IFA in 2016 |
| Federal tie | **None** — state-funded only (not EPA SRF) |
| Page | https://www.in.gov/ifa/srf/flood-control |
| Contact | Camille Meiners, P.E., cmeiners@ifa.in.gov, (317) 234-3661 |

### Eligibility
Political subdivisions: cities, towns, counties; regional water/sewer/waste/sanitary/conservancy districts (see IC definitions / fact sheet).

### Eligible project types
- Remove obstructions/debris from stream channels
- Clear/straighten channels
- Create/enlarge channels
- Build/repair dikes, levees, flood protective works
- Bank protection
- Establish floodways
- Other activities permitted under federal Flood Control Act and Clean Water Act

### Process notes (April 2026 fact sheet)
- Applications accepted year-round; IFA prioritizes as received
- One year from approval to complete financing
- Loan bounds cited in fact sheet: min **$100,000**, max **$250,000** per application (support with bids/quotes)
- Interest: **2.0%** (1–5 yr), **2.5%** (over 5 to 10 yr)
- Application fee **$500** (per application requirements document)

### Grant Intelligence Plane mapping
```
DISCOVERED → ELIGIBILITY_REVIEW → OPEN (year-round) → …
```
Classify as **state flood mitigation loan** (not EPA Brownfields / not federal CWSRF).  
Human eligibility review required; system only surfaces program facts + citations.

