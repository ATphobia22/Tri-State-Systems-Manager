# FEMA OpenFEMA integration

FEMA's open-data API (no key required): `https://www.fema.gov/api/open/v2/{DataSetName}`.
Verified live 2026-09-30. Client: `backend/geospatial/fema/openfema_client.py`
(stdlib only, fail-closed; tests in `backend/tests/test_openfema_client.py`).

## Datasets wired

| Dataset | Use for TSM |
|---|---|
| `DisasterDeclarationsSummaries` | Federal disaster-declaration history. Posey County, IN: 19 designations (floods, storms, winter storms, Katrina evacuation, COVID). Vendored: `data/fema-openfema/posey-county-disaster-declarations-v1.json` |
| `FimaNfipPolicies` | NFIP policy records (non-personal fields). Posey County sample vendored: `data/fema-openfema/posey-county-nfip-policies-sample-v1.json` — includes the anchor's NFIP community 180209 |
| `FimaNfipClaims` | NFIP claim records. Queried on demand via the client |
| `IndividualsAndHouseholdsProgramValidRegistrations` | IHP valid registrations by disaster/county. Queried on demand via the client |

## Notes

- OpenFEMA `metadata.count` values are unreliable; iterate records instead.
- The fema.gov HTML pages (data-sets catalog, developer resources) return
  403 to non-browser clients from this environment; the API itself works.
- Declaration history is context for grant narratives and community risk
  profiling. It is not flood-insurance or engineering evidence.
- All five endpoints are registered in
  `data/acquisitions/tsm-authoritative-source-manifest-v1.json`.
