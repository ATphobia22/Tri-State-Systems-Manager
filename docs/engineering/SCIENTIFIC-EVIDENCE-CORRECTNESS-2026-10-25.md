# Scientific evidence validation hardening — 2026-10-25

## Corrected P0 claims

### Gage-zero versus station altitude

Python must obey the same rule as `tsm-console/src/lib/gage-datums.ts`:
USGS station-altitude metadata is **not** evidence of the gage-zero relationship for parameter 00065. The recorded 352.71 ft station altitude for USGS 03378500 conflicts with a 352.67 ft candidate gage-zero relationship in USGS SIR 2016–5119. This conflict has not been reconciled across publication versions and source-product semantics.

**Implementation:** Python stores old reference heights as `STATION_ALTITUDE_REFERENCES_FT_NAVD88` for non-computational context only. The approved `GAGE_DATUMS_FT_NAVD88` table remains empty until a source- and parameter-specific station zero is independently checked, reviewed, versioned and published. `convert_stage_to_wse` therefore returns `UNAVAILABLE` and `wse_ft_navd88: None`, not an invented numerical value. A future approved datum can enable the documented conversion with explicit provenance and tests.

This behavior does not interrupt live gage display. It prevents promotion of an unverified derived water-surface elevation.

### HEC-RAS evidence

The previous extractor marked `VERIFIED` if the first eight bytes matched the HDF5 signature, no fatal messages existed, and a caller supplied `required_profiles_present=True`. A synthetic buffer of the magic bytes plus zeros satisfied the unit test. This is **not proof that the HDF5 file is parseable**, nor evidence of hydraulic convergence, valid geometry, depth grids or provenance.

**Implementation:** Successful byte-level preflight yields `UNVERIFIED` with an explicit `verification_scope`, even if the caller claims profiles are present and a fixture label was omitted. Invalid signature remains `DATA_ERROR`, reported fatal messages remain `NON_CONVERGENT`.

**Future VERIFIED gate:** parse a version-specific HEC-RAS HDF5 file with h5py, validate required datasets/profile completeness, validate execution record, compare WSE and continuity/mass balance with independent observations, confirm geodetic metadata, and seal precise file checksums. An HDF5 parser being installed is not itself proof.

### MODFLOW evidence

The previous extractor marked `VERIFIED` when arbitrary input buffers were non-empty and a caller-supplied scalar mass-balance error was within one percent, without parsing the MODFLOW 6 binary budget.

**Implementation:** A caller-supplied, finite, within-threshold mass-balance value produces `UNVERIFIED`, with `mass_balance_provenance: CALLER_SUPPLIED_NOT_PARSED`. Empty buffers or invalid scalar values produce `DATA_ERROR`; outside-threshold values retain `NON_CONVERGENT` as a screening result, not a parsed solver claim.

**Future VERIFIED gate:** independently parse actual MODFLOW 6 budget/head files (FloPy or verified equivalent), confirm time-step, cell counts, model convergence, storage/flow residuals, units, CRS, valid observation mapping, binary header semantics and provenance. No solver was executed or installation attempted by this patch.

## Provenance references

- USGS SIR 2016–5119: https://doi.org/10.3133/sir20165119
- USGS station: https://waterdata.usgs.gov/monitoring-location/USGS-03378500/
- USGS on stage and local gage datums: https://mn.water.usgs.gov/infodata/FAQStreamgaging.htm
- USACE HEC-RAS: https://www.hec.usace.army.mil/software/hec-ras/
- USGS MODFLOW 6: https://www.usgs.gov/software/modflow-6-usgs-modular-hydrologic-model

No derived flood elevation, hydraulic calibration, regulatory compliance or groundwater mass balance may be marked independently VERIFIED by these preflight functions. They retain hashes, errors and reviewable evidence while human authority remains final.
