# TSM Public Access and Authentication Boundary

## Public by default

The Tri-State Systems Manager public experience is intentionally usable without an account or password.

Anonymous users may:

- inspect the public map and 3D twin;
- view public USGS/NOAA/FEMA/Indiana source-backed layers;
- inspect source provenance, timestamps, CRS/datum metadata, and methodology;
- view public hydrology and flood-reference information;
- use bounded visualization/simulation features that do not mutate governed records.

No identity provider is required for these read-only capabilities.

## Privileged boundary

Authentication is retained only where an identity is necessary for authorization or accountability:

- evidence-ledger mutation;
- data-contract registration/mutation;
- operational administration;
- private/restricted datasets;
- publication or authorization actions requiring human review.

The client may be configured with Keycloak/OIDC for these privileged flows, but missing identity-provider configuration must never prevent anonymous public browsing.

## Security controls without accounts

Anonymous access is protected with server-side controls rather than mandatory registration:

- rate limiting and bounded concurrency;
- request and payload limits;
- caching for public data;
- server-side credential isolation;
- no secrets in browser bundles;
- explicit source freshness and provenance;
- fail-closed behavior for engineering/regulatory calculations lacking verified inputs.

## Cloud and CI credentials

GitHub Actions and cloud integrations should use OIDC/workload identity and short-lived credentials where supported. Long-lived credentials must not be embedded in the public application or committed to source control.

## Governance

Anonymous users can inspect model outputs and evidence, but the system does not silently convert visualization or simulation output into a regulatory determination. Human authority remains required for governed engineering and regulatory actions.
