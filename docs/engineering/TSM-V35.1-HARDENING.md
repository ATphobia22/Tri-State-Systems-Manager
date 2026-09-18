# TSM V35.1 Hardened Implementation

Status: implemented on main.

## Engineering changes

1. Bishop stability solver
   - Vectorized NumPy slice operations.
   - Strict finite-value and dimensional validation.
   - Safe m_alpha denominator checks.
   - Configurable factor-of-safety threshold.
   - Deterministic method version and SHA-256 input identity.
   - No synthetic engineering inputs or fallback results.

2. PostGIS subsurface plane
   - EPSG:2966 stored explicitly as the horizontal CRS.
   - NAVD88 stored explicitly as a separate vertical datum.
   - Identity-based layer keys.
   - Positive depth/strength constraints.
   - Overlapping strata rejected at the database boundary.
   - Provenance JSON retained at borehole and stratum level.

3. J.T. Myers telemetry
   - Uses verified USGS station 03322420 associated with John T. Myers Locks and Dam.
   - Does not relabel 03322000, which remains the separate Ohio River at Evansville station.
   - Uses the modern USGS Water Data API adapter already present in TSM.
   - AbortController timeout and response-shape validation remain fail-closed.
   - Last-known-good observations are explicitly marked STALE_CACHE and expose cache age.
   - Source station metadata and observation provenance remain distinct from TSM-derived dam influence.

4. Grant rules
   - Funding percentages and deadlines are modeled as mutable, cycle-specific data.
   - The universal 75/25 CCMG assumption was removed.
   - Indiana Section 319 is represented as 60/40 for approved projects, with the watershed-management-plan exception.
   - Section 204 is represented as project-specific and tied to applicable base-plan/incremental-cost treatment.
   - BRIC is represented by the verified closed FY2024-FY2025 cycle; future cycles require live verification.

## Governance

Grant data is evidence-supporting input, not an automatic eligibility, award, permit, or compliance determination. Engineering results remain subject to qualified human review and applicable agency requirements.
