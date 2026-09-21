# PTDT v35 Production-Readiness Gap Closure — 2026-09-18

## Scope
This record reconciles the requested production-readiness actions against the repository at main and current authoritative platform documentation available during the audit.

## Implemented

| Area | Result |
|---|---|
| Router lazy loading | Already implemented for heavy GIS routes; regression tests retained. |
| Parse/lexical failures | Parse gate now validates JavaScript, JSON, TypeScript and TSX syntax before typecheck/build. |
| Monitoring validation | Alertmanager and Prometheus validation already use pinned images and explicit amtool/promtool entrypoints. |
| Keycloak | Canonical VITE_KEYCLOAK_URL / REALM / CLIENT_ID bindings added with PKCE-compatible public-client configuration. |
| Production Pages bindings | Pages build binds Keycloak and live API values from repository Variables and fails closed when Pages is enabled but values are absent. |
| CSP | Deployment-aware Vite CSP added with WebAssembly, workers, map/tile endpoints and configured Keycloak origin. |
| Hydrologic resilience | Retry/backoff/circuit-breaking existed; bounded stale-cache fallback is now added. |
| Vertical datum | Explicit fail-closed datum normalization middleware added. Unverified gage/NGVD29 offsets are blocked. |
| Event bus | Server-side Kafka REST Proxy-compatible telemetry bridge added, disabled by default. |
| FEMA 18129C0265C | BFE-to-mesh equality contract added with NAVD88/provenance requirements. Existing source evidence remains fail-closed where exact current authoritative metadata is missing. |
| LOMC packet | ReportLab evidence-index PDF + SHA-256 manifest + ZIP assembly added; detached Ed25519 signing utility added. |
| Databricks CD | OIDC-gated workflow and production configuration contract added; intentionally disabled until workspace federation variables are configured. |
| CRS audit | HEC-RAS contract corrected from EPSG:26916 to the TSM engineering frame EPSG:2966. Native Indiana BAFM EPSG:26916 remains correctly documented as source-native. |
| WebGPU fallback | Explicit WebGPU → WebGL2 → Canvas 2D capability contract added. |

## External verification

### Databricks
Databricks currently documents GitHub OIDC workload identity federation for automated workloads and recommends avoiding long-lived Databricks secrets. The workflow therefore uses GitHub id-token: write, DATABRICKS_HOST, DATABRICKS_CLIENT_ID, a production GitHub Environment, and no Databricks PAT.

Current Databricks CLI release observed during this audit: v1.17.0, released 2026-09-16.

### Vertical datum
USGS documentation explicitly recognizes NAVD88, NGVD29 and arbitrary gage datums and explains that the gage datum is the zero/stage reference. Therefore the application must carry the source datum and only apply a published transformation when the station/product-specific conversion is available.

NOAA NWPS exposes gauge datum and vertical-datum fields in its API schema. TSM preserves source stage and separately derives NAVD88 WSE when the conversion contract is satisfied.

### CSP
Browser CSP connect-src governs fetch/XHR/WebSocket/EventSource connections. WebAssembly under a CSP requires wasm-unsafe-eval; this is narrower than unsafe-eval and is the policy used by TSM.

GitHub Pages can deploy custom static workflows but does not provide an application-level mechanism for arbitrary HTTP response headers from repository files. TSM therefore emits a document-level CSP from Vite and documents the reverse-proxy/header responsibility for hardened deployments.

## Deliberate production gates that remain operator-supplied

These values cannot be safely invented by the repository:

1. Keycloak production realm URL, realm, and client ID.
2. HTTPS production API origin.
3. Databricks workspace URL and service-principal client ID.
4. Databricks GitHub OIDC federation policy.
5. Actual Databricks lakehouse catalog/schema/worker contract.
6. Kafka/Stream Connect endpoint, topic and credentials/identity.
7. FEMA current authoritative BFE extraction/georeferencing artifact for panel 18129C0265C.
8. Sealed survey, FIRMette/FIS, FARA/eFARA, community acknowledgment and other FEMA LOMC evidence.
9. Ed25519 signing private key.

The system fails closed rather than substituting plausible-looking values.

## Validation commands

From tsm-console:

    npm run check:parse
    npm run check:type
    npm run check:workflow-boundaries
    npm run test:all
    npm run build

For the FEMA contract:

    npm run test:firm

For the LOMC packet:

    python tools/loma/build_loma_packet.py --source-dir /secure/loma/<case-id>/source --output-dir /secure/loma/<case-id>/output

Then sign the resulting PDF or manifest only from a controlled signing environment:

    TSM_EVIDENCE_SIGNING_KEY_PEM="$(cat /secure/key.pem)" node scripts/evidence/sign-evidence.mjs /secure/loma/<case-id>/output/LOMA-<case-id>-evidence-index.pdf /secure/loma/<case-id>/output/LOMA-<case-id>-evidence-index.pdf.ed25519

## Authority boundary
The system may compare a hydraulic mesh against a FEMA evidence value, but that comparison is an engineering/data-integrity contract. It is not a FEMA determination, Letter of Map Amendment/Revision, floodplain permit, no-rise certification, survey certification or professional engineering seal.