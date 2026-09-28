# Site Anchor Public Disclosure

**Status:** Active — owner-directed override of the community engineering boundary gate
**Effective date:** 2026-09-27
**Decision by:** Repository owner (ATphobia22)

## Decision

The repository owner has directed that the project site anchor —

- 13101 Bonebank Road, Point Township, Posey County, Indiana
- Coordinates 37.845887, -88.005075
- Related identifiers (`Bonebank`, `BONEBANK_SITE`, `BONEBANK_LOOKUP`, parcel 65-19-08-100-008.001-010)

— **remains in the public source tree**. The owner considers this accurate project
information and data, and has explicitly instructed that the boundary gate be
adjusted to permit it rather than redact it.

This supersedes the 2026-09-26 privacy redaction policy for the site anchor only.

## Scope

This disclosure covers the site-anchor identifiers listed above in public/runtime
paths (docs, source, scripts, schemas, data). It does **not** weaken any other
boundary:

- The restricted evidence plane remains restricted; public files must not
  reference its paths.
- River-station record integrity checks still apply.
- Regulatory gate status/authority/evidence checks still apply.
- The software-policy prohibition on software-only agency acceptance still applies.

## Marker

`SITE_ANCHOR_PUBLIC_DISCLOSURE`

Automated checks (`scripts/ci/validate-community-engineering-boundaries.mjs` and
`tests/privacy-community-scope.test.mjs`) honor this file: when it exists and
contains the marker above, the site-anchor pattern scan is skipped and the
remaining boundary checks continue to run.

## Revocation

To re-enable anchor redaction enforcement, delete this file (or remove the
marker) and the gate will fail on anchor identifiers in public paths again.
