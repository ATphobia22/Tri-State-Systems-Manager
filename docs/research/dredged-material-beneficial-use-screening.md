# Dredged-Material Beneficial Use for Flood-Resilience Screening

**Status:** Research and model-requirements note; conceptual only. Not a design, permit determination, funding commitment, or construction authorization.

## Purpose

Evaluate whether sediment produced by authorized navigation dredging could be beneficially reused in a future project for flood-resilience earthworks in the Ohio–Wabash corridor. Candidate uses may include engineered berms, roadway embankments, habitat features, and selected channel or cutoff interventions. These uses have different engineering and regulatory purposes and must be evaluated separately.

## Key findings

1. **The uploaded ERDC/CHL TR-22-4 report is regional context, not validation of the proposed flood works.** It documents an Adaptive Hydraulics investigation of sediment transport and navigation shoaling at the Wabash–Ohio confluence. Its alternatives were river-training structures intended to improve navigation-channel conditions. The study used a two-year hydrograph from 26 September 2015 to 26 September 2017 and 2018 field/bathymetry data. It does not demonstrate that filling a specific cutoff, raising a road, or placing a protective berm will lower flood stages or prevent overtopping at a particular property. It explicitly notes that the model did not address large-scale morphologic events and their consequences.
2. **Do not treat all dredged material as suitable fill.** Suitability is specific to source, sediment characteristics, intended use, exposure pathways, placement location, and regulatory requirements. Material acceptance must be based on representative sampling and laboratory results, not appearance or source alone.
3. **Section 204 and Section 205 are distinct authorities.** Section 204 is directed to eligible beneficial-use projects associated with dredging for an existing authorized federal navigation project, including aquatic/ecologically related habitat objectives and qualifying storm-damage reduction. Section 205 supports eligible small flood-damage-reduction projects. Neither is automatic eligibility for a stand-alone road raise or berm. USACE must confirm federal interest, sponsor eligibility, scope, cost-sharing, and current project limits.
4. **Floodway fill is a hydraulic intervention.** A cutoff plug, berm, or raised road can reduce conveyance, redirect flow, alter backwater, increase local water-surface elevations, affect drainage, or transfer risk. Compare alternatives in a calibrated model; do not assume fill reduces flood risk.
5. **All elevations must be tied to a verified source and common vertical datum.** The current conceptual berm and road readmes record a BFE of 369.1 ft NAVD88 and a lowest adjacent grade of 377.2 ft NAVD88, while a quarantined regulatory draft contains a superseded 375.0-ft working value. The 369.1-ft value is the current repository design basis, not a substitute for checking the effective FEMA FIRM/FIS, current Indiana DNR best-available mapping, the precise structure/site location, and survey control before analysis or filing.

## Arithmetic and terminology check

Using the currently recorded conceptual inputs only:

- Recorded lowest adjacent grade: 377.2 ft NAVD88.
- Recorded BFE: 369.1 ft NAVD88.
- Difference: 377.2 - 369.1 = **8.1 ft**.

This arithmetic is a difference between two recorded elevations, not proof of regulatory freeboard, flood protection, or safe access. The claim that a 2–4 ft berm and road raise produce 7.9–9.4 ft of clearance is not derivable from those inputs without a defined location, baseline ground profile, proposed crest/surface elevations, and water-surface results. If a height is added to the 377.2-ft grade at the same footprint, simple crest-minus-BFE arithmetic would be 10.1–12.1 ft; that is only a geometric comparison, not a hydraulic design result. Existing bottomland grade in the berm readme is separately estimated at approximately 371–372 ft and must not be conflated with the 377.2-ft anchor grade.

A regulatory BFE is location-specific. “Freeboard,” lowest adjacent grade, road-surface elevation, berm crest elevation, and modeled flood water-surface elevation are different quantities and must be stored and labeled separately.

## Material characterization and acceptance gates

Before a material lot can be marked acceptable for a proposed use, record the source dredging project and reach, sampling plan, sample locations/depths, chain of custody, laboratory, methods, dates, detection limits, and signed reports.

### Geotechnical tests, selected for the intended use

- Grain-size distribution and fines content; soil classification and Atterberg limits where applicable.
- Natural water content, organic content, specific gravity, and density.
- Compaction/moisture-density relationship (such as an appropriate Proctor method) and achievable field compaction.
- Shear strength, permeability, compressibility/consolidation, settlement, and erosion resistance as relevant to the proposed loading and hydraulic exposure.
- For treated/blended material, validate the treatment design and test performance and environmental side effects; do not assume lime/cement treatment is appropriate for a given sediment.
- Evaluate dewatering, stockpiling, handling, odor, runoff, leachate, and disposal of process water.

### Environmental and regulatory suitability

- Establish intended end use and exposure pathway before selecting analytes and screening criteria.
- Have USACE, IDEM, and other applicable authorities determine the required sediment characterization, contaminant testing, beneficial-use approval, water-quality certification, and placement conditions.
- Evaluate applicable Clean Water Act Section 404/401 requirements, Indiana DNR floodway requirements, wetland impacts, and any other federal/state/local permits. Applicability is project- and location-specific.
- Keep contaminated, uncharacterized, and rejected material out of the approved-fill inventory. Do not label material “clean” or “non-hazardous” without supporting results and the relevant authority's acceptance.

## Model Lab workflow

Each candidate scenario should remain **conceptual_only** until the applicable data and review gates are complete.

1. **Register source:** USACE dredging project/reach, material lot, planned quantity, dredging/characterization dates, source authority, and provenance identifiers.
2. **Validate data:** schema, units, coordinate reference system, vertical datum, survey epoch, geometry validity, missing values, and source-document hashes.
3. **Record laboratory evidence:** sample identifiers, methods, measured values, units, detection limits, quality-control flags, laboratory report hashes, and reviewer disposition.
4. **Define geometry:** surveyed or explicitly schematic alignment, stationing, existing ground, top width, side slopes, crest elevation, transitions, drainage crossings, and cut/fill footprint.
5. **Estimate quantities:** for a constant-height trapezoidal section with height h, top width b, and side slope z horizontal to 1 vertical, area is A = h(b + zh). For constant section and length L, volume in cubic yards is V = A × L / 27 when dimensions are in feet. Real terrain requires station-based cross-sections or surface-to-surface integration. Track in-situ, loose, and compacted volumes separately; a generic 20% allowance is not a material-specific shrinkage determination.
6. **Run hydraulic alternatives:** existing baseline; berm/road raise; cutoff left open; partial/controlled intervention; and any compensatory excavation or drainage alternative. Use appropriate boundary conditions, current terrain/bathymetry, roughness, structures, calibrated model settings, and sensitivity cases.
7. **Check performance and impacts:** water-surface changes at all relevant cross-sections, flow conveyance, floodway capacity, velocity/shear, drainage and backwater, erosion/scour, sediment transport, overtopping, seepage/piping, slope stability, settlement, and downstream/upstream risk transfer.
8. **Record evidence chain:** input hashes, model and solver versions, parameters, run logs, output hashes, validation status, uncertainty, reviewer, and timestamp. A successful process exit is not proof of a scientifically valid or permitted result.
9. **Keep approval states distinct:** screening_only, data_incomplete, environmental_review_pending, geotechnical_review_pending, hydraulic_review_pending, permit_pending, PE_review_pending, and approved_for_next_stage. Never infer construction authorization from a model result.

## Suggested acceptance criteria

A candidate is not eligible for a positive suitability recommendation until all required gates are explicitly resolved:

- [ ] Current regulatory flood mapping and effective BFE confirmed for the exact footprint.
- [ ] Horizontal and vertical datums reconciled with survey control.
- [ ] Representative material characterization complete and accepted for the intended use.
- [ ] Ownership, access, easements, utilities, wetlands, and placement rights checked.
- [ ] Hydraulic baseline calibrated/validated to the level required by the jurisdiction and project.
- [ ] Proposed and baseline scenarios compared, including uncertainty and off-site impacts.
- [ ] Geotechnical stability, seepage, settlement, erosion, and constructability reviewed.
- [ ] Applicable USACE, IDEM, Indiana DNR, local, and federal permits/consultations determined.
- [ ] Funding authority and non-federal sponsor obligations confirmed directly with USACE.
- [ ] Licensed Professional Engineer review and signed deliverables obtained where required.

## Program pathways to investigate

- **USACE CAP Section 204 — Beneficial Use of Dredged Material:** potentially relevant when the proposal is properly connected to dredging for an existing authorized federal navigation project and meets the statutory purpose and feasibility requirements.
- **USACE CAP Section 205 — Small Flood Risk Management Projects:** potentially relevant to qualifying flood-damage-reduction alternatives with a non-federal public sponsor.
- **Indiana DNR floodway review:** assess whether the footprint is within a regulated floodway and what technical, hydraulic, and environmental submittals are required.
- **IDEM / federal water permits:** determine water-quality certification and dredged/fill placement requirements based on waters, wetlands, source, and intended placement.

Program limits and cost shares change and may be described differently across older district pages. Obtain current written guidance from the responsible USACE district before treating any funding limit, share, or eligibility assumption as definitive.

## Sources

- Bell, G., Clifton, N., Abraham, D., and Lamkin, K. (2022). *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation*, ERDC/CHL TR-22-4. USACE ERDC. https://erdc-library.erdc.dren.mil/jspui/handle/11681/43630
- USACE, CAP Section 204 — Beneficial Use of Dredged Material (fact sheet, 15 April 2025). https://planning.erdc.dren.mil/toolbox/library/Factsheets/CAP_Sec204_FactSheet_15Apr2025.pdf
- USACE, CAP Section 205 — Small Flood Risk Management Projects (fact sheet, 15 April 2025). https://planning.erdc.dren.mil/toolbox/library/FactSheets/CAP_Sec205_FactSheet_15Apr2025.pdf
- USACE, *Dredging and Dredged Material Management*, EM 1110-2-5025. https://www.publications.usace.army.mil/Portals/76/Publications/EngineerManuals/EM_1110-2-5025.pdf
- Indiana DNR, Construction in a Floodway Assessment Information. https://www.in.gov/dnr/water/files/wa-floodway-assessment-info.pdf
- Indiana Natural Resources Commission, Information Bulletin #37 — Submission and Review of Hydraulic Modeling for Permit Applications under the Flood Control Act. https://www.in.gov/nrc/files/IB-37.pdf
- Indiana DNR, Indiana Best Available Floodplain Mapping. https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping
- FEMA, National Flood Hazard Layer database information. https://hazards.fema.gov/femaportal/NFHL/searchResult/

## Scope boundary

This note is a research and requirements artifact. It does not certify the suitability of any sediment, verify the current BFE at a specific structure, predict a flood-stage reduction, establish program eligibility, or authorize construction. Site-specific design and permit submissions require authoritative data, project-specific analysis, and the responsible licensed professionals and agencies.
