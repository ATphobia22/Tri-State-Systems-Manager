# Open-source ecosystem review for TSM

**Review date:** 2026-10-24  
**Purpose:** Identify reusable implementation ideas and candidates without adding unreviewed dependencies or treating popularity as evidence of correctness.

## Decision summary

- Use canonical upstream repositories and official documentation as the primary sources. Discovery directories (GitHub, SourceForge, OSDN, FossHub, F-Droid, curated collections) are leads, not license or provenance evidence.
- Do not add WordPress, Drupal, Joomla, Grav, Payload, or other website builders to the current React/TypeScript hydrology console: they solve a different product problem unless a separate CMS requirement is approved.
- Do not add a dependency merely because it is popular. Review exact upstream, license, release/maintenance signals, platform compatibility, transitive dependencies, security posture, data provenance, and reproducible test coverage first.
- Keep the existing application stack. The best near-term reuse candidates are geospatial/hydrology libraries behind isolated adapters, not a wholesale platform replacement.

## Candidate assessment

| Candidate | Verified purpose / license | TSM relevance | Decision |
|---|---|---|---|
| [PROJ](https://proj.org/en/stable/about.html) | CRS and geodetic coordinate transformations; MIT license | High: explicit CRS transformations with a mature geodetic engine | **Evaluate for backend adapter**; test grids, axis order, units, CRS/datum metadata, and transformation accuracy before use |
| [GDAL](https://gdal.org/) | Raster/vector geospatial data conversion and processing; MIT-style OSGeo license | High: DEM, raster, vector, and terrain ingestion | **Evaluate for isolated processing workers**; native binaries, driver surface, resource limits, and file validation require hardening |
| [ECMWF earthkit-hydro](https://github.com/ecmwf/earthkit-hydro) | Python hydrology functions including catchments, flow accumulation, river-network distance; Apache-2.0 with ECMWF intergovernmental notice | High: possible research/benchmark candidate for catchment computations | **Prototype only**; its repository labels maturity as incubating in current project metadata, so compare algorithms and outputs against trusted fixtures before production |
| [pysheds](https://github.com/pysheds/pysheds) | Python watershed delineation and DEM hydrology; GPL-3.0 | High technically, but license has distribution implications | **Do not import into a distributed product without explicit license review**; use only in a separate, approved evaluation if appropriate |
| [Apple Pkl](https://opensource.apple.com/projects/pkl/) | Typed/validated configuration language | Medium: illustrates validated configuration and generated artifacts | **Principle already applied** with JSON Schema and contract tests; no extra runtime/toolchain yet |
| [Apple FoundationDB](https://opensource.apple.com/projects/foundationdb/) | Distributed transactional key-value database | Conditional: durable evidence ledger only if current storage lacks a demonstrated consistency requirement | **Do not add** without a persistence architecture, operational ownership, backup/restore tests, and migration plan |
| [Apple SwiftNIO](https://opensource.apple.com/projects/swiftnio/) | Swift non-blocking networking framework | Low direct fit for TypeScript/Python runtime | **Do not add as a runtime dependency**; retain the transferable principle of deterministic network-boundary and failure-path tests |

## Adoption gate for any open-source component

1. Identify canonical upstream, exact version/commit, maintainer activity, supported runtimes, security advisories, and transitive dependencies.
2. Verify SPDX license and notices from the upstream repository; check redistribution, linking, dataset, and attribution terms separately. Do not infer code or data licensing from the download host.
3. Add a software bill of materials (SBOM) and dependency-review/security scanning where supported; pin through lockfiles and use immutable/tagged releases or verified commit digests for CI actions.
4. Keep components behind narrow adapters and preserve provenance fields (provider/dataset, retrieval/issue/valid time, CRS, vertical datum, units, license/attribution, payload digest, quality/freshness flags).
5. Establish deterministic golden fixtures and independent cross-checks before an algorithm may contribute to an engineering conclusion.
6. Do not auto-upgrade, auto-deploy, or merge based on search rankings. Require CI, human review, and a rollback path.

## Platforms and directories: intended use

| Source | Use | Guardrail |
|---|---|---|
| [GitHub](https://github.com/) | Canonical source, issues, releases, security metadata, CI evidence | Confirm repository identity and exact commit/tag; do not rely on stars alone |
| [Apple Open Source](https://opensource.apple.com/projects/) | Apple-maintained source and project-level documentation | Confirm per-project language, license, supported platform, and release model |
| [Google Open Source](https://opensource.google/) | Project discovery and security practices | Follow through to the canonical project and license |
| [SourceForge](https://sourceforge.net/), [OSDN](https://osdn.net/), [FossHub](https://www.fosshub.com/), [F-Droid](https://f-droid.org/) | Additional discovery or distribution channels | Download portals do not substitute for upstream provenance, signatures, or licensing checks |
| [Open Source Collection](https://opensourcecollection.com/) and [Opensource.com](https://opensource.com/) | Discovery, tutorials, and ecosystem context | Secondary sources only; verify claims at the project upstream |

## Sources

- Apple Open Source projects: https://opensource.apple.com/projects/
- Apple WWDC24 MapKit session: https://developer.apple.com/videos/play/wwdc2024/10097
- PROJ purpose and license: https://proj.org/en/stable/about.html
- GDAL documentation and license: https://gdal.org/
- ECMWF earthkit-hydro README and license: https://github.com/ecmwf/earthkit-hydro
- pysheds repository and license: https://github.com/pysheds/pysheds
- GitHub dependency and supply-chain security guidance: https://docs.github.com/en/code-security/concepts/supply-chain-security/supply-chain-security

## Explicit non-claims

No new geospatial runtime dependency was installed by this review. No model output was recalculated, no AOI was approved, and no external source was elevated to engineering authority. Candidates remain proposals until a separate, tested adapter implementation is accepted.
