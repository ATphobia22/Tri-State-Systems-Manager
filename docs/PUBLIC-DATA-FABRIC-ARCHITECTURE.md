# TSM Public Data Fabric Architecture

TSM uses operation-level access control rather than login-by-default.

## Access boundary

| Capability | Default identity requirement |
|---|---|
| Explore public maps and open datasets | None |
| Inspect provenance and source metadata | None |
| Run browser-local visualization or simulation parameters | None |
| Submit a community observation | None; quarantine/review boundary applies |
| Promote data into an authoritative workflow | Authenticated operator/reviewer |
| Append an authoritative ledger record | Authenticated reviewer |
| Agency or restricted data | Deployment-defined identity and authorization |

## Provenance contract

Persisted source-derived data should carry source organization, source URI, publication/acquisition date, retrieval time, native CRS, vertical datum when applicable, source-published license or usage terms, source-specific uncertainty or an explicit unknown state, limitations, source version, transformation chain, authority class, governance status, and a content hash.

TSM must not invent a license, uncertainty value, datum, publication date, or source authority. Unknown values remain explicit and can block an authoritative promotion workflow.

## Authority hierarchy

AUTHORITATIVE, DERIVED, OBSERVATIONAL, and PRESENTATION are authority classifications, not quality scores. Rendering an authoritative product does not make the rendering layer authoritative.

## Community contributions

Public observations are preserved as observations and must not overwrite authoritative records. Payload validation, receipt metadata, quarantine, duplicate handling, provenance, and human review belong between public submission and authoritative promotion.

## Simulation

Public users may change browser-local parameters without authentication. Simulation output remains derived/model output and is visibly non-regulatory.

## Deployment

Agency deployments may add OIDC, optional GitHub OAuth, private source connectors, KMS/HSM-backed signing, and agency-specific authorization. Production credentials, agency users, private keys, and identity-provider secrets remain deployment-secret-manager material.

## Non-authority

TSM is decision support. It does not issue permits, certify engineering, replace emergency-management instructions, or make regulatory determinations.
