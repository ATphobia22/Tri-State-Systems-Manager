# Indiana Floodway · FEMA FIS · TSM FARA Role

## 1. Indiana floodway delineation (methods)

**Legal frame**
- Floodway: channel + portions of floodplain needed to efficiently carry regulatory flood peak (IC 14-28-1; 312 IAC 10).
- Indiana floodway delineation is **more stringent** than federal criteria in DNR guidance.
- Construction in a floodway requires DNR approval under the Flood Control Act.

**Without FEMA designation (312 IAC 10-3-3)**
1. Establish regulatory peak discharge (standard engineering/statistics acceptable to commission)
2. Compute regulatory flood **profile** (start far enough downstream; bridges assumed open unless local conditions say otherwise; correlate with high-water marks when possible)
3. Delineate extent using profile elevations + best available maps / field survey as needed

**With modeling (General Guidelines for H-H Assessment of Floodplains in Indiana)**
- Chapter 8: HEC-RAS hydraulic modeling guidelines (DNR-acceptable)
- Floodway limits from encroachment analysis meeting state surcharge rules
- **DNR** still regulates to a **0.14 ft cumulative surcharge** under the Flood Control Act
- **FEMA floodways** (NFIP): projects must show **0.00 ft** rise (No-Rise) **or** CLOMR/LOMR path — local ordinances enforce this for NFIP participation
- Equal-conveyance reduction (classic 1D) removes conveyance from both overbanks until target surcharge; 2D methods include unit-discharge / equal-discharge reduction variants

**TSM**
- Surface citations + No-Rise / CLOMR pathways
- Store PE-sealed models and FARA PDFs as EvidenceArtifacts
- **Never** auto-delineate regulatory floodway or certify No-Rise

## 2. FEMA FIS report structure (standard sections)

Per FIS Report Technical Reference (current FEMA guidance):

| Section | Content |
|---------|---------|
| 1.0 | Introduction (NFIP, purpose, jurisdictions) |
| 2.0 | Floodplain management applications (boundaries, floodways, BFEs, coastal) |
| 3.0 | Insurance applications (SFHA) |
| 4.0 | Area studied (basin, flood problems, dams, levees) |
| 5.0 | Engineering methods (hydrology, hydraulics, coastal) |
| 6.0 | Mapping methods (control, base map, delineation, FIRM revisions) |

Supporting products: Summary of Discharges, **Floodway Data Table**, flood **profiles**, stillwater tables, FIRM panels / database.

**Posey:** FIS/FIRM effective **2014-11-05** (and any later revisions via MSC).

## 3. TSM role in FARA processing (clarified)

| TSM may | TSM must not |
|---------|----------------|
| Deep-link to INFIP (`in.gov/infip`) | Generate or issue a FARA |
| Accept user-uploaded FARA PDF → EvidenceArtifact | Approve floodway construction |
| Record BFE/APN/site constants for decision support | Claim No-Rise certification |
| Show Zone A / DA>1 mi² **triggers** as guidance | Replace DNR ESC or local floodplain administrator |
| Link H&H Model Library / modeling guidelines | Run unofficial regulatory surcharge as “compliance” |

**Flow:** Human opens INFIP → creates FARA → downloads PDF → optionally uploads to TSM ledger with `governance_status: human_authorized` after review.

## 4. GitHub scan (ATphobia22) — useful for TSM goals

| Repository | Relevance |
|------------|-----------|
| **Tri-State-Systems-Manager** | Primary TSM codebase (already integrated) |
| **TuckerInc.82-** | Ecosystem docs, CONTRIBUTING, SECURITY, production layout — align open-source governance & charter language |
| **ansible-aws-vpc-ha-wordpress** | Ansible AWS VPC + HA pattern — optional future **hosting** for TSM API (not floodplain science) |

Most other listed repos are large upstream mirrors/forks (node, jdk, ffmpeg, caddy, etc.) — **do not copy** into TSM. Prefer dependency use, not vendoring.

**Recommended integrations only**
1. From `TuckerInc.82-`: reuse CONTRIBUTING / SECURITY / charter stewardship wording where it matches Memorial Charter
2. From `ansible-aws-vpc-ha-wordpress`: reference as IaC option for production VPC when deploying token-proxy + evidence store — keep out of Scientific Plane



## 5. Additional GitHub repos scanned (tooling only)

All of the following are **forks** under ATphobia22 — not TSM source of truth:

| Repo | Optional use |
|------|----------------|
| langfuse | LLM observability if TSM later adds governed AI assistants |
| pgadmin4 | Admin UI pattern for PostgreSQL evidence store |
| cpp-httplib | Lightweight C++ HTTP if native edge services appear |
| FlyEnv / envkit-releases | Local dev environment convenience |
| anybuild / prism32 | Generic build/assistant experiments — out of TSM scope |

Do **not** vendor these into the Scientific or Evidence planes. Prefer official upstream packages as dependencies when needed.
