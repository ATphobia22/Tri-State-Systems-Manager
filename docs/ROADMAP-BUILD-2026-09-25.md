# Roadmap Build — 2026-09-25

Implements the 7 genuine gaps from `docs/EXECUTIVE-REVIEW-VERIFICATION.md` §3.
Built 2026-09-25 by 7 coordinated workstreams; all verification green (see log
`build-logs/roadmap-build.log`). Committed on `main`, not pushed.

## What was built

### 1. Rainfall-runoff hydrology — `tsm-console/src/lib/hydrology-runoff.ts`
SCS Curve Number method (S = 1000/CN − 10, Ia = 0.2S), cumulative runoff
differenced per timestep into a Q(t) hydrograph (cfs via 645.33 cfs per
sq-mi·in/hr). Lumped method: no routing, no baseflow — documented in the
header. Fail-closed validation on all inputs. 14 vitest tests incl.
hand-computed vectors (CN=80/P=3 → Q=1.25 in).

### 2. Hazus depth-damage engine — `tsm-console/src/lib/hazus-depth-damage.ts`
New module; `hazus-illustrative.ts` untouched. Occupancy types RES-1SNB,
RES-2SNB, COM, IND with structural + contents damage % tables at 0–10 ft
(RES-1SNB structural from the published USACE generic curve; others adapted to
published Hazus/USACE curve shapes), linear interpolation, 10-ft clamp (no
extrapolation). Outputs labeled **Hazus-compatible methodology — not
FEMA-certified**. 19 vitest tests.

### 3. FIRMette generator — `tools/loma/firmette.py`
Annotated evidence package: parcel overlay, BFE callout, north arrow,
disclaimers, annotation block, SHA-256 JSON manifest. Base-map retrieval
against FEMA NFHL REST fails closed to a watermarked
`BASE MAP UNAVAILABLE — OFFLINE` placeholder — never fabricated, gap never
silent. Renderer: HTML fallback (reportlab absent here); a reportlab PDF path
is implemented but untested in this environment. 17 pytest tests, offline.

### 4. 2D diffusion-wave inundation — `tsm-console/src/lib/hydraulics-diffusion2d.ts`
Explicit finite-difference diffusion-wave (zero-inertia) on a raster grid with
Manning-based face fluxes, closed boundaries, enforced diffusive-CFL
stability check. **Not full Saint-Venant** — the header documents why
diffusion-wave was chosen (operational standard for floodplain inundation,
tractable, testable) and its limits (no shocks, no supercritical flow, no
infiltration — volumes conservative). 5 vitest tests incl. flat-plane
mass conservation and symmetry.

### 5. Scenario runner + alerting — `tsm-console/src/lib/scenario-runner.ts`
Chains SCS runoff → diffusion-wave inundation → threshold alert records.
Coupling is a documented approximation: lumped total runoff spread uniformly
in space and time over the grid (screening-level only). Alert rules evaluate to
`triggered: true/false/'unknown'` — missing data yields `'unknown'`, never a
silent `false`. 6 vitest tests.

### 6. Provenance label taxonomy — `tsm-console/src/lib/provenance-labels.ts`
Standard labels: `FEMA-EFFECTIVE`, `STATE-BEST`, `OBSERVED`, `MODELED`,
`FORECAST`, `OWNER-SUPPLIED`, `DERIVED`, `UNAVAILABLE`. `makeProvenance`
(validates, dedupes, timestamps), `isAuthoritativeLabel` (true only for
FEMA-EFFECTIVE/OBSERVED), `describeProvenance`. Wired into
`native-data-fabric.ts` gauge observations (live/stale → OBSERVED,
unavailable → UNAVAILABLE) and attached to all new model outputs
(scs-cn-v1, hazus-dd-v1, diffusion-wave-2d-v1, scenario-runner-v1). 13 vitest
tests; pre-existing native-data-fabric suite still green.

### 7. LiDAR-merge job — `tools/terrain/merge-dem.py`
Operationalizes `docs/TERRAIN-RGB-3DEP-PIPELINE.md`: 3DEP/TNM tile discovery,
GDAL warp to EPSG:2966, per-tile SHA-256 manifest, resume-on-checksum-match,
atomic manifest writes, fail-closed on bad bbox/paths. `--dry-run` exercises
the full logic with synthetic tiles and zero network/GDAL (the CI path; GDAL
is absent here). 13 pytest tests.

## Key design decisions
- **Contract-first parallel build**: the provenance API was specified up front
  so 4 streams could code against it while it was implemented; integration held.
- **Fail-closed everywhere**: invalid inputs throw; missing data →
  `UNAVAILABLE`/`'unknown'`; offline base maps watermarked, never invented.
- **Honest labeling**: no self-certifying compliance claims in code; Hazus
  outputs marked compatible-not-certified; diffusion-wave never called
  Saint-Venant; FIRMette marked `DRAFT … HUMAN_REVIEW_REQUIRED`,
  `regulatory_determination: false`.
- **Reuse**: new modules build on `h3-spatial-fabric`, `river-gauges`,
  `native-data-fabric`, and `build_loma_packet.py` conventions — no duplicates.

## Remaining limitations (not done)
- SCS is lumped: no channel routing, no baseflow, no calibration against gauge
  events — validate against USGS benchmarks before operational use.
- Hazus curves need local calibration; 10-ft clamp is a fail-safe, not science.
- Diffusion-wave is screening-level; the build-vs-revise decision on true 2D
  Saint-Venant (per `docs/EXECUTIVE-REVIEW-VERIFICATION.md`) is closed below in
  "Decision: 2D hydraulic strategy (2026-09-25)": revise claims to match
  implementation, full Saint-Venant deferred.
- FIRMette PDF path (reportlab) was tested 2026-09-25 (venv, reportlab
  5.0.1): **fails** — 5/17 tests, `FileNotFoundError` in
  `tools/loma/firmette.py generate_firmette`: the PDF artifact is hashed for
  the manifest table before `build_pdf_reportlab` writes it (ordering bug;
  HTML path unaffected). Live FEMA base-map retrieval remains untested
  (no network here).
- `merge-dem.py` real-mode fetch is operator-only and untested (no GDAL here).
- Swift/iOS still uncompiled; `.ipa` still needs a Mac; GitHub push still
  blocked on user auth.

## Decision: 2D hydraulic strategy (2026-09-25)

**Decision:** the sanctioned 2D hydraulic capability is the diffusion-wave
(screening) model in `tsm-console/src/lib/hydraulics-diffusion2d.ts`; full 2D
Saint-Venant remains deferred future work and is not claimed anywhere.

**Context:** `docs/EXECUTIVE-REVIEW-VERIFICATION.md` raised a build-vs-revise item against
the 2D solver: either build true 2D Saint-Venant (shocks, supercritical flow,
infiltration) or revise claims to match the implemented diffusion-wave
(§4 above). Review of the implementation and its claims:

- `hydraulics-diffusion2d.ts` is an explicit finite-difference diffusion-wave
  (zero-inertia) raster model with Manning-based face fluxes, closed
  boundaries, and enforced diffusive-CFL stability; the module header and all
  doc references already state **"Not full Saint-Venant"** and list its
  limits (no shocks, no supercritical flow, no infiltration — volumes
  conservative; screening-level only).
- Nothing in code or docs claims Saint-Venant, full momentum conservation,
  or regulatory-grade 2D results from this module; the scenario runner (§5)
  documents its coupling as a screening-level approximation.

**Rationale:** diffusion-wave is the operational standard for floodplain
inundation screening, it is tractable and testable (5 vitest tests incl.
mass conservation and symmetry), and full Saint-Venant would add
substantial complexity without changing the fail-closed screening posture
of the console. Building it now is not justified; over-claiming what exists
would violate the honest-labeling design rule.

**Outcome:** item closed as **"revise claims to match implementation"** —
claims stay at diffusion-wave screening level; full 2D Saint-Venant is
deferred future work and must not be implied in any grant, UI, or engineering
text until an executable, tested integration exists.
