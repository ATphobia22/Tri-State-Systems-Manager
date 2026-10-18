# Indiana Drainage Handbook — TSM Permitting Reference

**Document:** *Indiana Drainage Handbook*, Christopher B. Burke Engineering, Ltd.
**Authority:** Developed under Indiana Public Law 329-1995
**Pages:** 495
**Location:** `~/workspace/user/files/84C66E57-59B9-4699-B82C-9BAABCCD8214-allhbook.pdf`

## Purpose

This is the authoritative Indiana regulatory reference for drainage and floodplain work. It governs what any Bonebank berm or road-elevation project would need for permitting.

## Key Regulatory Paths

### Indiana Drainage Code (IC 36-9-27)
- County drainage boards have jurisdiction over regulated drains
- Any berm/drainage modification in Posey County falls under the County Drainage Board

### IDNR Floodway Permitting (312 IAC 10)
- Construction in a floodway requires DNR Division of Water approval under the Flood Control Act
- Indiana regulates to **0.14 ft cumulative surcharge** (more stringent than FEMA's 1.0 ft)
- FEMA floodways (NFIP): projects must show **0.00 ft rise** (No-Rise) or go through CLOMR/LOMR

### Federal Permits
- **USACE Section 404** (Clean Water Act) — dredge/fill in waters of the US
- **USFWS** — endangered species consultation
- **NRCS** — agricultural/wetland impacts

## Relevance to TSM Designs

All current TSM berm/road designs in `data/designs/` are labeled:
- **CONCEPTUAL — NOT FOR CONSTRUCTION**
- **REQUIRES LICENSED PE REVIEW**

This handbook is the reference for what that PE review path looks like:
1. County Drainage Board approval (IC 36-9-27)
2. IDNR Floodway permit (312 IAC 10) — No-Rise certification or CLOMR
3. USACE 404 permit if waters of the US are affected

## Contents Overview

| Section | Content |
|---------|---------|
| §1 | Introduction |
| §2 | Permitting processes (local, IDNR, IDEM, USACE, USFWS, NRCS) |
| §3–5 | Drainage improvement practices selection guide (sediment control, in-channel floodwater retention) |
| §6 | References |

## Cross-References

- Berm designs: `data/designs/berm/README.md`
- Road designs: `data/designs/road/README.md`
- FARA role: `docs/` (FLOODWAY-FIS-FARA-ROLE.md in user files)
- Indiana floodway rules: 0.14 ft DNR surcharge vs 0.00 ft FEMA No-Rise
