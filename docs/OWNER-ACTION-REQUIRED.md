# Owner-Action Required

Checklist of everything that needs the **owner** — items that cannot be fixed
by code. Code can describe, gate, and record these, but it cannot resolve
them, because resolution requires authoritative confirmation, filed paperwork,
licenses, credentials, or physical-world measurements that only the owner can
provide. (Fail-closed principle: the repo leaves these as `null`/draft/unresolved
rather than guessing.)

*Maintained: 2026-09-25. Sources: `docs/DRIVE-MANIFEST.md` §C, `docs/NFIP_CID_VERIFICATION.md`, `docs/grants/POSEY-2026-STATE-GRANT-CALENDAR.md`, findings F8–F12.*

---

## 1. Site-coordinate discrepancy (~6.4 km)

**What:** Two coordinates are asserted for the anchor site (the restricted site):
- `37.9035, -88.0007` — PTDT v35 codex "surveyed centroid" (also in `docs/archive/drive-import/ptdt-v32-33-engineering-workspace.md` and `tsm-console/src/lib/scientific-analytics.ts`).
- `37.84589, -88.0051` — MT-1 mapping / geocoded address point.

These are **6.42 km apart** — far beyond any rounding or CRS nuance; they cannot
both be the site.

**Why code can't fix it:** only a licensed survey or authoritative site record
can establish the true coordinate. Code comparing the two just reports the gap.

**What's needed:** owner confirms which coordinate is correct (survey plat,
county parcel record, or professional survey) and retires the other across the
codex documents. Until then, nothing in the repo may treat either as an
engineering design input.

## 2. FEMA Community ID disagreement

**What:** LOMA package checklist cites **180194**; the BRIC dossier and
`docs/NFIP_CID_VERIFICATION.md` cite **180209** (Posey County Unincorporated —
the CID the current TSM SSOT uses). MT-1 mapping cites `18129C`, which is a
FIRM panel prefix, not a CID. `docs/DRIVE-MANIFEST.md` §C lists this as
unresolved.

**Why code can't fix it:** CIDs are assigned by FEMA; the correct one for the
parcel is a matter of FEMA/IDNR records, not computation.

**What's needed:** owner confirms the correct Community ID for the restricted site via FEMA Map Service Center / the Posey County floodplain administrator,
then the LOMA checklist gets corrected.

## 3. FIRM panel disagreement

**What:** four different panels are cited for the site:
- **18129C0215D** — PTDT codex, BCA data package, LOMA checklist, v35 regulatory dossier;
- **18129C0265C** — MT-1 mapping / LOMA source bundle;
- **18129C0225D** — BRIC FY2025 narrative, no-rise certification draft;
- **18129C0300C** — `docs/NFIP_CID_VERIFICATION.md` says this is the current
  TSM SSOT panel (NFHL `EFF_DATE` 2014-11-05).

**Why code can't fix it:** the correct panel is whatever FEMA's Map Service
Center indexes for the site address; documents can disagree arbitrarily.

**What's needed:** owner pulls the authoritative panel for the restricted site
from FEMA MSC (or the Posey County floodplain office) and consolidates all
filing documents to that panel before any filing.

## 4. BCR figures need Toolkit export verification

**What:** BCA documents assert **BCR 1.41** (engineering) and **2.45** (legal).
`docs/DRIVE-MANIFEST.md` §C notes these are in-doc assertions **without an
attached FEMA BCA Toolkit export** in the collection. They are planning inputs
only; the grant rules encode BCR ≥ 1.0 as the FEMA bar, but the figures
themselves are unverified.

**Why code can't fix it:** a BCR is only as good as the Toolkit run behind it;
code cannot reconstruct or attest to a benefit-cost run it never saw.

**What's needed:** owner locates the actual FEMA BCA Toolkit export (`.bca` /
Toolkit PDF) from the owner's files and attaches it to the BCA data package.
Until then, BCR numbers stay labeled as unverified assertions.

## 5. No-Rise package filing

**What:** `docs/regulatory/loma/no-rise-certification-DRAFT.md` is an unfiled
**DRAFT** with placeholder seals. A no-rise certification for floodway work
must be filed with (and accepted by) the Indiana Department of Natural Resources
Division of Water before construction.

**Why code can't fix it:** filing is a legal act by a licensed engineer and the
property owner with the state agency; a repository draft has no regulatory
standing.

**What's needed:** owner has the certification sealed by a licensed Indiana PE
and filed with IDNR Division of Water; the repo record then gets updated with
the filed version and receipt.

## 6. Gage-datum acquisition (per-node research outcome)

**What:** `hydrologic_nodes[].gage_zero_navd88_ft` is `null` for all five
nodes, so the `datum_control` gate can never clear. USGS-site metadata was
queried on 2026-09-25:

| Node | Source tried | Result |
|---|---|---|
| 03378500 Wabash River at New Harmony, IN (USGS) | USGS Water Data API (`api.waterdata.usgs.gov`; `/v1/site` is not a valid endpoint path); legacy WaterServices site service (empty reply — service degrading ahead of Feb 2027 retirement); WDFN monitoring-location page (lists available data, **no gage-datum elevation**) | **LEFT NULL** |
| 03322000 Ohio River at Evansville, IN (USGS) | same USGS attempts | **LEFT NULL** |
| 03322420 Ohio River at Uniontown Dam, KY (USGS) | same USGS attempts | **LEFT NULL** |
| MTVI3 Ohio River at Mount Vernon, IN (NWS) | NWS NWPS API (`api.water.noaa.gov/nwps/v1/gauges/MTVI3`) — response carries **no datum field at all** | **LEFT NULL** |
| UNWK2 Ohio River at J.T. Myers (NWS) | NWS NWPS API — same, no datum field | **LEFT NULL** |

Even when USGS station descriptions publish a gage datum, it is conventionally
**NGVD29**, not NAVD88 — and the task rule (and fail-closed doctrine) forbids
the repo from converting datums itself. A null here is the correct,
honest state.

**Why code can't fix it:** a gage zero in NAVD88 must come from a published
authority (USGS Water Science Center field office, NWS WFO gage notes, or a
licensed survey). Guessing or converting would corrupt every stage-to-elevation
computation downstream.

**What's needed:** owner obtains, per gage, a published gage-zero elevation in
**NAVD88** with its source, then records the value with
`vertical_conversion_source` set to that source (e.g. `"USGS-IN-WSC"`,
`"NWS-WFO-PAH"`). Procedure: (1) request gage metadata from the USGS Indiana
Water Science Center / NWS Paducah; (2) if only NGVD29 is available, a licensed
surveyor or agency datum-conversion statement is required — the repo will not
perform the conversion itself.

## 7. INDOT CCMG FY2027 deadline — 2026-09-30

**What:** per `docs/grants/POSEY-2026-STATE-GRANT-CALENDAR.md` and the grant
rules, INDOT Community Crossings (CCMG) FY2027 opened ~Sep 1, 2026 and **closes
Sep 30, 2026, 5:00 p.m. EDT** — 5 days from this writing. Requires an approved
Asset Management Plan and a local resolution; scope is road/bridge/culvert
only (levee/berm work does not fit).

**Why code can't fix it:** submitting requires county approval, the AMP, and a
political decision by the owner/county.

**What's needed:** owner decides within days whether a road/drainage project
qualifies and files through INDOT before the deadline; otherwise the window is
missed until the next call.

## 8. BRIC/FMA next-NOFO watch

**What:** FEMA BRIC FY24–25 rounds closed Jul/Aug 2026; there is **no FY26
NOFO** in the collection. The FY2025 subapplication narrative in the repo is a
draft for a closed window — template only.

**Why code can't fix it:** FEMA sets its own NOFO schedule; nothing in the repo
can create a funding opportunity.

**What's needed:** owner watches FEMA's BRIC/FMA pages for the next NOFO and
refreshes the narrative + BCA (see item 4) when it drops.

## 9. Swift compile + .ipa signing — Mac required

**What:** per `docs/BUILD-IOS.md`, producing a signed installable `.ipa`
requires **macOS with Xcode** and an **Apple Developer Program** membership.
The Xcode project exists (`tsm-console/ios/`, app ID `org.tristate.tsm.ios`)
and the macOS CI workflow is prepared, but compilation/signing cannot run on
this Linux environment.

**Why code can't fix it:** Apple tooling is macOS-only and signing needs the
owner's developer identity.

**What's needed:** owner (or a Mac with the owner's Apple Developer
membership) runs the build per `docs/BUILD-IOS.md` and produces the signed
`.ipa`.

## 10. GitHub auth for push

**What:** local `main` carries commits not on the remote
(`https://github.com/ATphobia22/Tri-State-Systems-Manager`); pushing needs the
owner's GitHub authentication, which the agent does not have.

**Why code can't fix it:** credentials belong to the owner; the agent must not
request, store, or fabricate them.

**What's needed:** owner provides GitHub auth (or pushes from their own
machine); the coordinator's commits go up then.

## 11. Hazus local calibration

**What:** the Hazus depth-damage path in the repo is illustrative / methodology-
labeled only; a credible local damage estimate needs calibration to Posey
County building stock, first-floor elevations, and historical loss data.

**Why code can't fix it:** calibration inputs (local structure inventory,
assessor data, past claims) live with the owner/county, and selecting them is
an engineering judgment call.

**What's needed:** owner supplies local building-stock/assessor data (or
accepts the methodology-labeled illustrative outputs as non-determinative)
and a qualified reviewer signs off on calibration before any use in BCA or
public materials.

## 12. SCS validation vs USGS benchmarks

**What:** the SCS Curve Number runoff path is lumped (no channel routing, no
baseflow, no calibration against gauge records). Its results have not been
validated against USGS observed benchmarks (e.g. gages 03378500, 03322000).

**Why code can't fix it:** validation requires observed discharge records and
engineering judgment about fit; running more code does not create ground truth.

**What's needed:** owner (or retained engineer) benchmarks SCS runoff output
against USGS gage observations for representative events and documents the
fit before SCS outputs inform any engineering conclusion.

---

*Rule of thumb: if resolving it requires an agency, a license, a credential,
a signature, or a physical measurement — it's on this page, not in a commit.*
