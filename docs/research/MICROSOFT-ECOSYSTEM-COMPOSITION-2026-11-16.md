# Microsoft Ecosystem Composition Lab for Tri-State Systems Manager

**Research date:** 2026-11-16  
**Target repository baseline:** [ATphobia22/Tri-State-Systems-Manager @ 79c528b0359266386811948b23ecff24909cdb09](https://github.com/ATphobia22/Tri-State-Systems-Manager/commit/79c528b0359266386811948b23ecff24909cdb09)  
**Source scope:** 43 URLs from owner prompt, 42 distinct repositories (microsoft/fluentui occurred twice).  
**Status:** verified repo metadata/README review + proposed engineering design, **NOT implemented products, certified engineering, installed software, or passed native Windows release evidence**.  
**Authority rule:** human authority final. Source URLs, signatures, graphics, and AI suggestions never imply survey, FEMA, professional engineering, or independent model certification.

## Governing compatibility contracts

1. **Offline native autonomy:** UE5.8 + local TSMData + C++/SpatiaLite remains fully usable with network unplugged; no WebView, localhost server, forced account, or live cloud dependency. Windows packaging and signature evidence stay separate from user-facing simulations.
2. **Headless except visualization:** acquisition, parsing, data QA, contract validation, model execution, reports, packaging and release attestations run headlessly; only map/3D rendering and optional explicit UI use headed output.
3. **Scientific authority:** observe vs derive vs simulate vs render; source dates, CRS, vertical datum and units are carried end-to-end. EPSG:2966/US survey feet and NAVD88 require explicit compatible conversions; no silent datum coercion.
4. **Public access:** basic viewing anonymous and free; optional Microsoft Entra/Teams/SharePoint integrations belong exclusively in a separate municipal privileged plane. Enterprise tenants grant their own consent.
5. **Independent release evidence:** preserve expected 23,082 Posey building identities; do not 'fix' gaps by lowering denominator. Source tests never prove full Unreal Shipping, clean Windows 11 offline startup, cinematic FPS/VRAM, or regulatory approval.
6. **Advisory innovation checks:** research readiness is non-blocking. A proposed or untrusted feature must remain labeled PENDING/NOT_EVIDENCED; a failed quality check cannot assert completion.

## Eight candidate product lines (novel integrations, not existing features)

| ID | Product | Reuse existing TSM capability | Complementary source ideas | Differentiating deliverable | Priority |
| --- | --- | --- | --- | --- | --- |
| G1 | **GeoTruth Inspector** | 3D buildings, LiDAR, terrain, geoid, evidence chain | Explainable CV, ONNX (instead of CNTK), PowerToys command UI | Every feature maps to evidence/height residual/conflict and missingness; preserve 23,082 target | P0 |
| G2 | **Civic Evidence Passport** | Parcel/feature identity, source registry, time/datum fields, Merkle receipts | Open XML SDK; Azure REST specs; .NET pooled streams | Portable parcel/infrastructure review dossier with source timeline, caveats, hashes, DOCX/XLSX | P0 |
| G3 | **Government Data Contract Foundry** | NIEM/JSON Schema, FEMA/USGS/IGIO/DNR adapters, Data Harvest monitors | TypeSpec/OpenAPI generation patterns; TDSP methodology | Versioned agency adapter declarations and schema-drift impact map; source-vintage validation | P0 |
| G4 | **Civil Dependency Graph** | PostGIS, roads/parcels/levees/gages, hydraulic screening | GraphEngine graph-query ideas (not archived runtime); reproducible scenario patterns | Time-aware infrastructure impact chain with assumptions and scenario uncertainty | P1 |
| G5 | **TwinOps Command Deck** | UE5.8 native editor/operator experience, twelve layer planes, stage HUD | PowerToys command-palette UX; WinUI 3; Fluent UI for web | Searchable native engineering actions & evidence navigation, no embedded browser | P1 |
| G6 | **AgencyBridge Review Channel** | Human-review approvals, evidence files, release/status ledger | MSAL Python/.NET, Identity Web, Teams JS, Microsoft 365 Agents SDK and optional SharePoint adapters | Tenant-approved review notifications, structured approval receipts, no direct regulatory filing | P1 |
| G7 | **Civic Storyboard Studio** | Unreal cameras, golden-hour scenes, historic flood timelines | Rocketbox rigged avatars; 3D Movie Maker storyboard UX | Reproducible public explainers linking every visual beat to dated evidence or labeled simulation | P2 |
| G8 | **TwinRelease / Municipal Distribution Desk** | TSM online/offline installer work, existing Authenticode and attestations | WinGet manifests, Intune packaging, PowerToys quality UX, NuGet practices | Public signed offline package + optional online bootstrapper + separate agency-managed Intune package | P1 |

## Implementation blueprints

### G1 — GeoTruth Inspector

- **Inputs:** authoritative building footprint IDs, LiDAR/DSM/DEM source identifiers and point samples, geoid/datum metadata, roof estimates, mesh/tileset ID mapping and source hashes.
- **Pipeline:** headless feature-ID join -> coverage audit (expected 23,082) -> height residual and roof-plane conflict calculations -> render-asset link checks -> geospatial indexed QA records.
- **Output:** GeoJSON QA layer with `building_id`, `source_sha256`, `roof_height_m`, `ground_height_m`, `height_delta_m`, `residual_m`, `qa_status`, `reason`, `confidence_class`, `model_or_observation`, `source_acquired_at`, `vertical_datum` (unknown values null).
- **Acceptance:** independently reconcile IDs and edge cases; no inferred heights counted as surveyed; compare against real test control data. CI with synthetic geometry is only code evidence; physical accuracy requires independent checkpoints. Render metadata loaded is not mesh rendering proof.
- **Libraries:** avoid Excel CV examples as runtime; implement independently in existing Python/C++ geospatial pipeline with optional maintained ONNX model manifest+checksum.

### G2 — Civic Evidence Passport

- **Identifiers:** jurisdiction, parcel key with versioned geometry ID, asset id, source authority, effective date, observation time, hash of input bytes, CRS and vertical datum.
- **Document outputs:** DOCX administrative packet and XLSX table generated from a single immutable manifest. Separate report structure from calculation. Each chart/table references source rows and calculation code/config versions.
- **Data integrity:** immutable payload hash, validation results, completeness and conflict list. No hidden defaults for missing NAVD88/gage zero. Sign published release artifacts, not claims about professional certification.
- **First acceptance:** one public Posey demo parcel with genuine retrieved source records, explicit nulls where unavailable, two generated documents and a manifest that reproduces each statement. Unit-test document parsability with Open XML SDK.
- **Windows architecture:** .NET helper invoked as a bounded CLI after local files are staged; RecyclableMemoryStream applies here only if benchmarks show value. UE5 viewer reads passport JSON without hosting .NET or web server.

### G3 — Government Data Contract Foundry

- **Source registry fields:** agency authority, service/layer id, geographic coverage, acquisition/publication/retrieval dates, CRS, vertical datum, units, licensing, access conditions, checksum, schema version.
- **Workflow:** registry -> type generation/validation -> retrieval permission + geographic count preflight -> immutable download -> normalization -> contract diff -> downstream parcel-to-terrain and feature-ID join impact graph.
- **Authority:** official FEMA/USGS/IGIO/DNR/USACE/NOAA sources remain primary. A schema passing tests is not an ingested layer. Defer unstable Azure API-specific dependencies; copy TypeSpec/OpenAPI design patterns, not its cloud services.
- **First acceptance:** detectable changed field/source vintage, reproducible diff and source-bound map change summary; do not break public map viewing if a remote agency is temporarily unavailable.

### G4 — Civil Dependency Graph

- **Nodes:** parcel, road segment, bridge/culvert, drainage catchment, levee, pump station, substation, public facility, water system, gage and source/evidence event.
- **Edges:** physically connected to, drains to, supplies power to, accessible via, applies to parcel, model-run depends on, derived from evidence. Every edge has relationship type, evidence source, valid interval and review state.
- **Engine:** keep canonical spatial geometry in PostGIS with network analysis and explicit materialized graph projection. Do not deploy archived Microsoft Graph Engine.
- **Scenario example:** hypothetical river stage changes -> candidate road closure overlay -> emergency-route connectivity impact -> pump access at risk. Stage/closure thresholds require official local evidence; no predictive operational closure claim without validation.
- **Acceptance:** independent spatial join tests, event times/units, connectivity benchmarks, human reviewed road closures and no automated evacuation advisories.

### G5 — TwinOps Command Deck

- **User actions:** Find parcel, inspect geoid/datum, compare source timestamps, isolate missing heights, open provenance, compute *screening* freeboard, inspect scenario input versions, capture scene, export evidence packet, view release readiness.
- **UI:** native Windows control layer using modern WinUI 3 where independently feasible; no WebView2 or localhost. Browser Atlas may use Fluent UI React components separately.
- **Message transport:** local signed/validated command and receipt file schemas or in-process native APIs, not WebSocket/HTTP. UE retains 3D viewport ownership.
- **Acceptance:** deterministic command replay, keyboard/accessibility audit, user confirmation for any privileged mutation; offline-only runtime test.

### G6 — AgencyBridge Review Channel

- **Trust model:** independent opt-in enterprise Teams/SharePoint application with Entra delegated permissions wherever feasible; tenant consent, policy, retention and audit logging. Do not require accounts for the public.
- **Events:** source revision, municipal review request, evidence packet publication, simulation caveat update, release signature availability.
- **Scope:** assistants may summarize cited evidence and draft review notes. Never issue permit, certification, regulatory filing, flood warning or official approval.
- **Platforms:** prefer current Microsoft 365 Agents SDK and Teams SDK. Do not start new TeamsFx, retired Graph Toolkit or Company Communicator development.
- **Acceptance:** explicit permissions manifest, tenant sandbox, least-privilege tests, disable/revoke workflow, shared document access audit and human-approved dispatch.

### G7 — Civic Storyboard Studio

- **Create:** camera/story beat -> timestamp -> source layer/evidence hash -> visual assets -> rendered caption/disclaimer.
- **Avatar policy:** Rocketbox avatars are visual placeholders; avoid representing them as measured residents or actual evacuation behavior. Check asset licenses and FBX-to-Unreal conversion.
- **Acceptance:** every scene is reproducible, labels observational facts vs simulations; render performance independently measured. 3D Movie Maker is UX inspiration only.

### G8 — TwinRelease / Municipal Distribution Desk

- **Artifacts:** full offline signed UE5.8 EXE, optional small hash-pinned online installer, enterprise Intune package if separately requested. Optional MSIX can be researched without replacing Inno.
- **Distribution:** immutable GitHub Release tag, real SHA-256 after signing, publisher signer and timestamp evidence, WinGet package manifest matching actual published URL.
- **Claim boundary:** public Windows trusted signing requires independent chain validation; a self-signed test certificate is not public publisher trust. Release trust reporting can remain non-blocking but must never silently claim certified or tamper-proof.
- **Acceptance:** independent clean Windows 11 run, air-gapped native launch, packages include valid TSMData hashes and no WebView/localhost/mandatory sign-in.

## First executable vertical slice — source contract drift

This research PR also introduces **one real headless, standard-library-only prototype**, not eight finished products: [`scripts/government/source_contract_impact.py`](../../scripts/government/source_contract_impact.py).

It compares existing `sources` entries in two **local** JSON catalogs by stable source ID, detects added/removed sources and changed service URL/layer ID, CRS, vertical datum, units, coverage, source version, publication/acquisition times and checksum fields. It emits a transparent JSON assessment including source hashes, unresolved metadata and **advisory** parcel-to-terrain impact hints. It makes no network calls, downloads no datasets, creates no accounts, and cannot certify geometry.

Run without dependencies:

```sh
python scripts/government/source_contract_impact.py \
  --before /path/to/older-catalog.json \
  --after /path/to/newer-catalog.json \
  --output dist/research/agency-drift-advisory.json

python -m unittest discover -s tests/government \
  -p test_source_contract_impact.py -v
```

Existing official dataset catalog shape: `data/schemas/tsm-indiana-data-catalog-v1.json`. Empty changes only mean **no field differences between the two inputs**. They do not demonstrate source freshness, public API availability, scientific validity or actual parcel/terrain geometry equality. The dedicated research workflow runs synthetic tests and a snapshot-to-itself fixture; it does not run a Windows release, update source data, or install cloud services.

**Next feature PR needed:** map this advisory report into the existing evidence ledger and twelve-plane status UI, add verified live agency snapshots with correct acquisition times, then require human review before promoting any changed source. Do not make the advisory analysis a mandatory release gate.

## Cross-product composition

```text
     public anonymous             optional privileged municipal companion
     MapLibre/Atlas               MSAL + Teams/SharePoint/Agents
            |                                  |
            v                                  v
   READ-ONLY TSM EVIDENCE QUERY       HUMAN APPROVAL / PUBLISH
            |                                  |
            +---------------+------------------+
                            |
       asset/parcel identifier + authority/provenance graph
                            |
           PostGIS / staged snapshots / headless validation
                            |
          screening solvers / source QA / scenario timelines
                            |
             validated scene and evidence manifests
                     /                 \
              Unreal native       DOCX/XLSX report
              offline runtime       export (CLI)
```

**Nonnegotiable:** renderers never modify scientific authority; enterprise integrations never become prerequisites for anonymous civic viewing or offline native application.

## Priority and dependency sequence

| Milestone | Necessary foundations | Acceptable proof |
| --- | --- | --- |
| M0 | Reconcile building inventory and source-datum uncertainty | 23,082 identity-target audit with unresolved records, not fabricated heights |
| M1 | G1 GeoTruth pilot on bounded Posey sample | stable feature IDs, raw/source hash, conflict/residual output, headless deterministic tests |
| M2 | G2 Evidence Passport DOCX/XLSX pilot | canonical manifest input, document repeatability and actual content citation checks |
| M3 | G3 agency contract diff + status timeline | changed official source field/vintage, null-safe impact list, verified access boundaries |
| M4 | G4 dependency graph on one verified catchment | grounded node-edge set + independently reviewed scenario assumptions |
| M5 | G5 TwinOps operator UI and G8 distribution | native headed tests, verified offline install, signing receipts |
| M6 | G6 Teams/365 pilot and G7 civic narrative | explicit opt-in tenant consent and documented synthetic visual boundary |

**Stop line:** licensing review, production credentials, independent surveying/checkpoints, regulatory certification and native Windows build evidence are separate requirements. Do not claim implementation of any G1–G8 module based on this research/architecture document.

## Complete 42-source disposition matrix

Treat `ADAPT` as promising but not yet integrated. `METHOD`, `REFERENCE` and `DISCOVER` mean learn from patterns rather than copy/ship. `OPTIONAL` requires an explicit tenant/runtime use case. `REPLACE` and `AVOID` prohibit adding the existing deprecated/high-risk repository as a new shipping dependency. GitHub's top-level SPDX metadata is incomplete for some repositories; independently inspect the real LICENSE and assets before copying code.

| Repository | Decision | Candidate contribution or reason | GitHub/readme status |
| --- | --- | --- | --- |
| [microsoft/Microsoft.IO.RecyclableMemoryStream](https://github.com/microsoft/Microsoft.IO.RecyclableMemoryStream) | **ADAPT** | Modern .NET report/export or ingestion worker only; benchmark pooling and peak RAM; not C++ Unreal. | MIT; active |
| [AzureAD/microsoft-authentication-library-for-python](https://github.com/AzureAD/microsoft-authentication-library-for-python) | **OPTIONAL** | Entra sign-in for explicitly enabled agency-side Python connectors; never public viewer. | Inspect LICENSE; active |
| [amzn/computer-vision-basics-in-microsoft-excel](https://github.com/amzn/computer-vision-basics-in-microsoft-excel) | **METHOD** | Explainable pixel/edge algorithms as teaching reference, independently implement geospatial QA; do not copy NC-licensed materials. | README CC BY-NC-SA 4.0; noncommercial restrictions |
| [microsoft/Quantum](https://github.com/microsoft/Quantum) | **REPLACE** | Archive of classic QDK; use modern microsoft/qsharp only in isolated research benchmarking, not engineering acceptance. | MIT; archived |
| [OfficeDev/microsoft-teams-library-js](https://github.com/OfficeDev/microsoft-teams-library-js) | **OPTIONAL** | Signed-off reviews and evidence links in Microsoft Teams app context, not native runtime dependency. | Inspect LICENSE; active |
| [microsoft/CNTK](https://github.com/microsoft/CNTK) | **REPLACE** | No new CNTK model training/runtime; use portable ONNX/ONNX Runtime where scientific ML is justified. | Archived; legacy model tooling |
| [OTRF/Microsoft-Sentinel2Go](https://github.com/OTRF/Microsoft-Sentinel2Go) | **LAB_ONLY** | Red-team/security telemetry lab to test release and connector hardening; not part of offline shipping app. | GPL-3.0; isolation and license review |
| [Azure/Microsoft-TDSP](https://github.com/Azure/Microsoft-TDSP) | **METHOD** | Historical data-science lifecycle/checklist ideas: source audit, uncertainty review, benchmark datasets. | CC BY 4.0; archived/deprecated |
| [microsoft/GraphEngine](https://github.com/microsoft/GraphEngine) | **METHOD** | Adopt graph question patterns in PostGIS/SQL or other maintained graph library; do not deploy archived engine. | MIT; archived |
| [OfficeDev/microsoft-365-agents-toolkit-samples](https://github.com/OfficeDev/microsoft-365-agents-toolkit-samples) | **REFERENCE** | Use conceptual samples for isolated enterprise agency pilot; replace any legacy TeamsFx dependencies. | MIT; active samples, some not production-ready |
| [microsoft/fluentui](https://github.com/microsoft/fluentui) | **ADAPT** | React public Atlas controls / evidence review UI; honor separate font/icon asset licensing. | MIT code; verify asset license |
| [aspnet/MicrosoftConfigurationBuilders](https://github.com/aspnet/MicrosoftConfigurationBuilders) | **REFERENCE** | Config snapshot and provider composition patterns; actual library targets legacy .NET Framework. | MIT; active but framework-specific |
| [ItzLevvie/MicrosoftTeams-msinternal](https://github.com/ItzLevvie/MicrosoftTeams-msinternal) | **AVOID** | Internal/pre-release Teams build downloader is not an authorized integration path. | No validated right to private/internal builds |
| [MicrosoftEdge/WebView2Samples](https://github.com/MicrosoftEdge/WebView2Samples) | **OUTSIDE_NATIVE** | Optional online inspector or admin utility only; no WebView/localhost in sovereign Unreal Shipping runtime. | Sample licenses require inspection |
| [MicrosoftEdge/MSEdge](https://github.com/MicrosoftEdge/MSEdge) | **REFERENCE** | High-level Chromium/interoperability strategy document, not a modern browser engine dependency. | MIT repository; old 2018 document |
| [microsoft/PowerToys](https://github.com/microsoft/PowerToys) | **PATTERN** | Command Palette, extensible small-tools UX, windowing/shortcut ergonomics for TwinOps native shell. | MIT; active |
| [dotnet/Open-XML-SDK](https://github.com/dotnet/Open-XML-SDK) | **ADAPT** | Generate source-backed Word/Excel municipal engineering and grant packets offline. | MIT; active |
| [integrations/microsoft-teams](https://github.com/integrations/microsoft-teams) | **OPTIONAL** | Route approved GitHub/release/engineering notices into agency Teams channels. | No license declaration; platform app integration |
| [Azure/azure-rest-api-specs](https://github.com/Azure/azure-rest-api-specs) | **METHOD** | Apply TypeSpec/OpenAPI-first, generated SDK and versioned adapter patterns for official government source connectors. | MIT; active |
| [Azure/Microsoft365R](https://github.com/Azure/Microsoft365R) | **OPTIONAL** | R-based county/grant statistical reporting export to authorized Microsoft 365 locations. | Inspect LICENSE; active |
| [NuGet/docs.microsoft.com-nuget](https://github.com/NuGet/docs.microsoft.com-nuget) | **REFERENCE** | NuGet packaging/version pinning/SBOM documentation for optional native C# companion. | MIT; docs |
| [OfficeDev/microsoft-teams-apps-company-communicator](https://github.com/OfficeDev/microsoft-teams-apps-company-communicator) | **REPLACE** | Audience/acknowledgment ideas only; template officially retired 2025-03-31. | MIT; retired product |
| [microsoft/tslint-microsoft-contrib](https://github.com/microsoft/tslint-microsoft-contrib) | **AVOID** | Historical lint examples only; use TypeScript strict + current ESLint, not deprecated TSLint. | MIT; archived |
| [microsoft/Microsoft-Win32-Content-Prep-Tool](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool) | **OPTIONAL** | Wrap finalized Windows EXE for Intune enterprise distribution, not public user installer. | Vendor license terms; review redistribution |
| [microsoft/Microsoft-Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) | **OPTIONAL** | Rigged avatars for explicitly synthetic civic education scenes; verify each bundled asset. | MIT repository; archived |
| [AzureAD/microsoft-authentication-library-for-dotnet](https://github.com/AzureAD/microsoft-authentication-library-for-dotnet) | **OPTIONAL** | Entra authentication for a separate .NET municipal admin/export companion, not anonymous runtime. | MIT; active |
| [OfficeDev/microsoft-365-agents-toolkit](https://github.com/OfficeDev/microsoft-365-agents-toolkit) | **OPTIONAL** | Build an opt-in, human-approved municipal communications/review companion using current Agents SDK. | Inspect LICENSE; active toolkit |
| [microsoft/Microsoft-3D-Movie-Maker](https://github.com/microsoft/Microsoft-3D-Movie-Maker) | **METHOD** | Storyboard authoring/story progression UX inspiration; never reuse the unsupported 1995 engine. | MIT; archived |
| [microsoft/Microsoft.Unity.Analyzers](https://github.com/microsoft/Microsoft.Unity.Analyzers) | **OPTIONAL** | Only for a Unity-based asset conversion/previsualization toolchain, not UE C++ diagnostics. | MIT; active |
| [microsoft/AI](https://github.com/microsoft/AI) | **REFERENCE** | Review classic ML benchmark/sample patterns; validate and modernize before any adoption. | MIT; curated sample archive, freshness varies |
| [microsoft/opensource.microsoft.com](https://github.com/microsoft/opensource.microsoft.com) | **METHOD** | OSPO transparency, contribution, licensing and public-interest project documentation patterns. | MIT; active |
| [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) | **ADAPT** | Publish verified EXE/MSIX manifest when matching public release binary and SHA-256 exist. | MIT; active |
| [microsoft/MicrosoftEdge-Extensions](https://github.com/microsoft/MicrosoftEdge-Extensions) | **OPTIONAL** | Separate consent-based government-source evidence-capture extension in Edge, never native runtime. | MIT repository; active |
| [microsoftgraph/microsoft-graph-toolkit](https://github.com/microsoftgraph/microsoft-graph-toolkit) | **AVOID** | Retired August 2026: use supported Graph SDKs with separately maintained UI. | Archived/retired |
| [MicrosoftEdge/MicrosoftEdge-Extensions-Demos](https://github.com/MicrosoftEdge/MicrosoftEdge-Extensions-Demos) | **REFERENCE** | Historical extension demos only; use maintained extension API docs. | Archived |
| [MSEndpointMgr/Intune](https://github.com/MSEndpointMgr/Intune) | **REFERENCE** | Deployment/detection recipes for municipal endpoint pilots; independently audit scripts. | MIT; active community |
| [su-sid/Microsoft-Office-2021](https://github.com/su-sid/Microsoft-Office-2021) | **AVOID** | Office activation/install scripts are not a legitimate foundation for document export. | License undeclared; activation risks |
| [MicrosoftEdge/MicrosoftEdge-Documentation](https://github.com/MicrosoftEdge/MicrosoftEdge-Documentation) | **REPLACE** | Archived documentation; use live Microsoft Learn and supported Edge extension docs. | Archived |
| [OfficeDev/BotBuilder-MicrosoftTeams](https://github.com/OfficeDev/BotBuilder-MicrosoftTeams) | **REPLACE** | Legacy Bot Framework 3.x extension; official README directs use of newer Teams SDK. | MIT; unsupported SDK |
| [vgrem/office365-rest-python-client](https://github.com/vgrem/office365-rest-python-client) | **OPTIONAL** | SharePoint/Microsoft Graph Python adapter for tenant-approved source packets. | MIT; active |
| [thangchung/awesome-dotnet-core](https://github.com/thangchung/awesome-dotnet-core) | **DISCOVER** | Candidate discovery checklist only; every downstream package needs independent vetting. | License undeclared for collection |
| [AzureAD/microsoft-identity-web](https://github.com/AzureAD/microsoft-identity-web) | **OPTIONAL** | Identity on separate ASP.NET Core privileged API, not in offline or public viewer. | MIT; active |

## Validation and non-claims register

- [ ] Each new dependency has verified version, full license, attribution, vulnerability scan and supported target architecture.
- [ ] Every data source has official authority, retrieval date, CRS, datum, units, geographic envelope, license and raw-input SHA-256.
- [ ] Source ingestion is headless, bounded, testable and reproducible from immutable offline snapshots.
- [ ] Cross-border rules respect separate IN/IL/KY jurisdiction and source version rather than silently applying Indiana defaults.
- [ ] In-scope data shows missingness, conflicting observations and credible confidence limits rather than synthetic fills.
- [ ] Native UE5.8 Win64 Shipping generated and tested on a real Windows 11 runner; separately check GPU scenes, FPS, VRAM and tile count.
- [ ] Public viewing remains anonymous; optional account/Teams connectors are strictly isolated from public/runtime services.
- [ ] Engineering acceptance and published regulatory determinations remain human/agency controlled.
- [ ] Online signer, WinGet and Intune are distribution steps only; no certificate proves flood model correctness.
- [ ] New research ideas remain advisory, not mandatory failed release gates.

## Sources reviewed (primary)

All 42 GitHub repositories linked above were checked for repository metadata and README content on 2026-11-16. The detailed list is the audit register. Relevant current official documentation:

- [Windows native UI and WinUI 3](https://learn.microsoft.com/en-us/windows/apps/winui)
- [Open XML SDK Word document creation](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-create-a-word-processing-document-by-providing-a-file-name)
- [Open XML SDK spreadsheet creation](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/how-to-create-a-spreadsheet-document-by-providing-a-file-name)
- [Microsoft Graph Toolkit retirement](https://devblogs.microsoft.com/microsoft365dev/microsoft-graph-toolkit-retirement/)
- [Modern Teams/Microsoft 365 agents guidance](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/agents-toolkit-fundamentals)
- [Microsoft Graph permissions and delegated consent](https://learn.microsoft.com/en-us/graph/permissions-overview)

**Research-only PR policy:** Do not merge as implementation work. Engineering code, real benchmark data and independent verification require separate feature PRs.
