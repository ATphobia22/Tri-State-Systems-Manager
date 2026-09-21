# Production completion baseline

Repository: ATphobia22/Tri-State-Systems-Manager
Boundary: public-interest civic data fabric with operation-level authorization.

## Runtime-complete boundaries
- Public exploration does not require an account.
- Browser-local simulation does not require an account.
- Community observations are anonymous-capable, validated, provenance-bound and quarantined.
- Authoritative evidence mutation requires authenticated authorization.
- Ledger append requires reviewer authorization.
- OIDC authorization-code + PKCE + nonce is server-managed.
- Browser sessions use encrypted __Host- cookies; access tokens are not exposed to browser JavaScript.
- Production secrets are deployment material, not repository material.
- Authoritative source fetching is constrained to registered source authority and endpoint paths.
- Geospatial proxying is constrained by registered hosts, bounds, dimensions and byte budgets.
- Source-derived products retain explicit authority/provenance metadata.
- Simulation and engineering model outputs remain derived/model products until human governance promotes them.
- Public data does not become regulatory authority merely because TSM renders it.

## Deployment-complete requirements
These cannot be safely fabricated in source control and must be supplied by each deployment:
- real agency identity-provider issuer/audience/client registration;
- production client secret;
- session encryption secret;
- agency user/group/role assignments;
- private signing keys;
- KMS/HSM configuration;
- production database/object-store credentials;
- trusted ingress/proxy configuration;
- production DNS/TLS certificates;
- agency retention, records-management and incident-response policies.
The repository deliberately fails closed where required deployment configuration is missing.

## Verification boundary
A repository merge is not equivalent to an agency authorization-to-operate, regulatory certification, engineering certification, or emergency-management authority.
Post-merge GitHub Actions status must be observed from GitHub for the exact commit before a release is called verified. Missing workflow status is an unknown state, not a pass.

## Source-of-record boundary
TSM is a federated decision-support layer. Federal/state/local source agencies retain authority over their published products. TSM stores provenance, hashes, transformations and governance state so users can trace a result back to source evidence.

## Development fixtures
Synthetic fixtures must remain explicitly marked as development/simulation data. They must never be represented as live government observations or authoritative regulatory evidence.