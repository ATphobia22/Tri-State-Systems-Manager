# Official funding sources — federal and Indiana (October 26, 2026)

This registry classifies **portals** rather than claiming that every portal
lists current awards, that every program accepts private individuals, or that
TSM is qualified to receive grants.

Machine-readable catalog:
[`data/registries/tsm-official-funding-portals-2026-10-26.json`](../../data/registries/tsm-official-funding-portals-2026-10-26.json).
It includes 25 official discovery, history, applications and agency-system
entries, all flagged `specificOpportunityStatus: NOT_VERIFIED` unless
the separate dated example explicitly reports a live official listing.

## How TSM should use them

1. **Discover opportunities:** [Grants.gov](https://www.grants.gov/),
   [Simpler.Grants.gov](https://simpler.grants.gov/developers), and
   [Indiana State Agency Grant Opportunities](https://www.in.gov/sba/grants/resources-for-subrecipients/state-agency-grant-opportunities/).
   Simpler.Grants.gov's API supports search and retrieving opportunities;
   **it does not submit grant applications**. Its API key and rate limits require
   authorized setup. No credentials belong in the public repository.
2. **Understand program authority:** [SAM.gov Assistance Listings](https://sam.gov/content/assistance-listings)
   is a catalog of assistance programs, **not evidence of an active NOFO**.
3. **Inspect awards:** [USAspending.gov](https://www.usaspending.gov/) is
   historical award information, **not a live opportunity announcement**.
4. **Help families find assistance:** [USA.gov benefits](https://www.usa.gov/benefits)
   routes individual users to benefits and aid. Organizational federal grants
   are ordinarily **not personal cash assistance**.
5. **Apply only with authorization:** [DOJ JustGrants](https://justicegrants.usdoj.gov/),
   [IDHS IntelliGrants](https://www.in.gov/dhs/grants-management/intelligrants/),
   [OCRA CDBG](https://www.in.gov/ocra/cdbg/cdbg-construction-grants/) and
   [INDOT Rail](https://www.in.gov/indot/multimodal/railroad/grant-application-process/)
   have their own accounts, eligibility and workflows. OCRA's 2026 construction
   program uses eGMS, IDHS has both older iGMS and newer IntelliGrants,
   and INDOT rail uses Access Indiana/ITAP/GRIP.
6. **Grant administration:** [Indiana SBA eCivis implementation guidance and the current Euna/AmpliFund opportunity listing](https://www.in.gov/sba/grants/ecivis-implementation-information/)
   describes earlier grants implementation and lifecycle, while the
   [current SBA opportunities listing](https://www.in.gov/sba/grants/state-agency-grant-opportunities/)
   links to **Euna Grants Powered by AmpliFund**. Neither name establishes
   one universal application portal for all Indiana grantors.
7. **Geospatial funding candidates:** [Indiana GIO](https://www.in.gov/gis/)
   and the [IndianaMap ATLAS page](https://www.indianamap.org/pages/atlasgrant~2536c15f8d014d0ca76a769663067653)
   are discovery/context only until an actual current solicitation is confirmed.

## Time-sensitive public examples (read from official sources October 26, 2026)

- **OCRA 2026 Round 2 Stormwater Improvements:** proposal due
  **October 4, 2026** (already past); application due
  **December 13, 2026**; max published award **$750,000** with **10%**
  local match, subject to applicable CDBG requirements and eligibility.
  TSM itself is **not** thereby qualified to submit as a private organization.
- **Indiana IDHS FY2027 HMEP:** official listing shows **November 5, 2026**
  deadline at **4:30 p.m. Eastern**. Verify eligible public-safety
  applicants and actual NOFO before treating it as relevant.
- **Indiana OED HOMES/HEAR:** homeowner **rebates**, which should not
  be mislabeled as competitive grant awards for the TSM engineering system.

Sources:
[OCRA Construction](https://www.in.gov/ocra/cdbg/cdbg-construction-grants/),
[IDHS Grants](https://www.in.gov/dhs/grants-management/),
[OED funding](https://www.in.gov/oed/grants-and-funding-opportunities/),
[Simpler.Grants.gov developers](https://simpler.grants.gov/developers),
[Grants.gov grant programs](https://www.grants.gov/learn-grants/grant-programs).

## Engineering evidence and governance

A real funding opportunity requires an immutable snapshot of its official
agency identifier, release and close dates, eligible applicants, purpose,
geography, match, NOFO URL/hash, authorized organization, reviewer, and
signed decision before inclusion in an application-ready queue.
Keep links as `DISCOVERY_ONLY` when these are missing.
No auto-generated applicant identity, no scraped credentialed portals,
no automated applications, and **no flood-risk or No-Rise claims generated
by a funding score**.

The 3D Tiles, scientific validation, UE Windows Shipping and privacy gates
remain independent of grant-discovery CI.
