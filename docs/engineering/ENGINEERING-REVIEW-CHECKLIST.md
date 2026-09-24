# Engineering Review Checklist

## Source and provenance
- [ ] Authoritative source identity recorded.
- [ ] Retrieval and observation timestamps recorded.
- [ ] Horizontal CRS and vertical datum are distinct and validated.
- [ ] Source or product version/effective date recorded.
- [ ] SHA-256 content hash recorded where an artifact is retained.
- [ ] Transformation chain is complete.

## Hydrology
- [ ] Observation versus forecast is explicitly separated.
- [ ] Gage datum is not compared directly with NAVD88 BFE/LAG.
- [ ] Freshness policy passes or the state is explicitly STALE.
- [ ] Missing source data produces SOURCE_UNAVAILABLE, not a synthetic value.
- [ ] Dam influence is treated as derived evidence, not asserted causality.

## Hydraulics and engineering
- [ ] Real model artifact and model hash are identified.
- [ ] Base/proposed conditions are comparable.
- [ ] Boundary conditions and time/mesh semantics are documented.
- [ ] No-rise criterion is explicitly identified.
- [ ] Finite-value and unit checks pass.
- [ ] Engineering calculations remain derived/model evidence.

## Regulatory
- [ ] Applicable FEMA, Indiana and local pathways are identified.
- [ ] FEMA effective products remain separate from Indiana Best Available products.
- [ ] FARA/LOMA/LOMR/CLOMR pathway is determined by the applicable authority.
- [ ] Required professional and agency review is documented.
- [ ] Software status has not been promoted to AGENCY_ACCEPTED.

## Release
- [ ] Privacy, security and dependency gates pass.
- [ ] Production build and end-to-end tests pass.
- [ ] Exact commit has completed GitHub Actions successfully.
- [ ] Deployment-specific credentials and policies are configured outside source control.
